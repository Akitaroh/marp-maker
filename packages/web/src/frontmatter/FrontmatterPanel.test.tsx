/**
 * ZDD Atom: Atom-FrontmatterPanel のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-FrontmatterPanel.md "検証経路" セクション
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  FrontmatterPanel,
  type FrontmatterPanelProps,
  type FrontmatterValues,
} from './FrontmatterPanel'

function setupProps(
  overrides: Partial<FrontmatterPanelProps> = {}
): FrontmatterPanelProps {
  return {
    open: true,
    values: {},
    onApply: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('FrontmatterPanel - visibility', () => {
  it('does not render when open is false', () => {
    const props = setupProps({ open: false })
    render(<FrontmatterPanel {...props} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open is true', () => {
    const props = setupProps({ open: true })
    render(<FrontmatterPanel {...props} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Frontmatter 設定')).toBeInTheDocument()
  })
})

describe('FrontmatterPanel - form values reflection', () => {
  it('reflects size from values', () => {
    const props = setupProps({ values: { size: '16-9' } })
    render(<FrontmatterPanel {...props} />)

    const sel = screen.getByTestId('fm-size') as HTMLSelectElement
    expect(sel.value).toBe('16-9')
  })

  it('size is "未設定" (sentinel) when values.size is undefined', () => {
    const props = setupProps({ values: {} })
    render(<FrontmatterPanel {...props} />)

    const sel = screen.getByTestId('fm-size') as HTMLSelectElement
    expect(sel.value).toBe('__unset__')
  })

  it('reflects title / author / description / header / footer', () => {
    const values: FrontmatterValues = {
      title: 'T',
      author: 'A',
      description: 'D',
      header: 'H',
      footer: 'F',
    }
    const props = setupProps({ values })
    render(<FrontmatterPanel {...props} />)

    expect((screen.getByTestId('fm-title') as HTMLInputElement).value).toBe('T')
    expect((screen.getByTestId('fm-author') as HTMLInputElement).value).toBe('A')
    expect(
      (screen.getByTestId('fm-description') as HTMLTextAreaElement).value
    ).toBe('D')
    expect((screen.getByTestId('fm-header') as HTMLInputElement).value).toBe('H')
    expect((screen.getByTestId('fm-footer') as HTMLInputElement).value).toBe('F')
  })

  it('reflects paginate boolean', () => {
    const props = setupProps({ values: { paginate: true } })
    render(<FrontmatterPanel {...props} />)

    expect(
      (screen.getByTestId('fm-paginate') as HTMLInputElement).checked
    ).toBe(true)
  })

  it('paginate defaults to false when undefined', () => {
    const props = setupProps({ values: {} })
    render(<FrontmatterPanel {...props} />)

    expect(
      (screen.getByTestId('fm-paginate') as HTMLInputElement).checked
    ).toBe(false)
  })
})

describe('FrontmatterPanel - apply / cancel', () => {
  it('apply fires onApply with current draft + auto onClose', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClose = vi.fn()
    const props = setupProps({
      values: { size: 'A4' },
      onApply,
      onClose,
    })
    render(<FrontmatterPanel {...props} />)

    await user.type(screen.getByTestId('fm-title'), 'New Title')
    await user.click(screen.getByTestId('fm-apply'))

    expect(onApply).toHaveBeenCalledTimes(1)
    const applied = onApply.mock.calls[0]![0] as FrontmatterValues
    expect(applied.size).toBe('A4')
    expect(applied.title).toBe('New Title')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancel does not fire onApply, fires onClose', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClose = vi.fn()
    const props = setupProps({ onApply, onClose })
    render(<FrontmatterPanel {...props} />)

    await user.type(screen.getByTestId('fm-title'), 'discarded')
    await user.click(screen.getByTestId('fm-cancel'))

    expect(onApply).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('size unset sentinel results in size: undefined on apply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const props = setupProps({
      values: { size: 'A4' },
      onApply,
    })
    render(<FrontmatterPanel {...props} />)

    await user.selectOptions(screen.getByTestId('fm-size'), '__unset__')
    await user.click(screen.getByTestId('fm-apply'))

    const applied = onApply.mock.calls[0]![0] as FrontmatterValues
    expect(applied.size).toBeUndefined()
  })

  it('size change to 16-9 reflects in apply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const props = setupProps({ onApply })
    render(<FrontmatterPanel {...props} />)

    await user.selectOptions(screen.getByTestId('fm-size'), '16-9')
    await user.click(screen.getByTestId('fm-apply'))

    const applied = onApply.mock.calls[0]![0] as FrontmatterValues
    expect(applied.size).toBe('16-9')
  })

  it('paginate toggle reflects in apply', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const props = setupProps({ onApply })
    render(<FrontmatterPanel {...props} />)

    await user.click(screen.getByTestId('fm-paginate'))
    await user.click(screen.getByTestId('fm-apply'))

    const applied = onApply.mock.calls[0]![0] as FrontmatterValues
    expect(applied.paginate).toBe(true)
  })
})

describe('FrontmatterPanel - close behavior', () => {
  it('closes on Escape key', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onApply = vi.fn()
    const props = setupProps({ onApply, onClose })
    render(<FrontmatterPanel {...props} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('closes on overlay click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onApply = vi.fn()
    const props = setupProps({ onApply, onClose })
    render(<FrontmatterPanel {...props} />)

    await user.click(screen.getByTestId('frontmatter-modal-backdrop'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('closes on close button click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const props = setupProps({ onClose })
    render(<FrontmatterPanel {...props} />)

    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FrontmatterPanel - draft reinit on re-open', () => {
  it('reinitializes draft when values change between renders', () => {
    const onApply = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(
      <FrontmatterPanel
        open={true}
        values={{ title: 'first' }}
        onApply={onApply}
        onClose={onClose}
      />
    )

    expect((screen.getByTestId('fm-title') as HTMLInputElement).value).toBe(
      'first'
    )

    // values が変わって再 open
    rerender(
      <FrontmatterPanel
        open={true}
        values={{ title: 'second' }}
        onApply={onApply}
        onClose={onClose}
      />
    )

    return waitFor(() => {
      expect((screen.getByTestId('fm-title') as HTMLInputElement).value).toBe(
        'second'
      )
    })
  })
})

describe('FrontmatterPanel - accessibility', () => {
  it('dialog has aria-modal and aria-labelledby', () => {
    const props = setupProps()
    render(<FrontmatterPanel {...props} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })

  it('close button has aria-label', () => {
    const props = setupProps()
    render(<FrontmatterPanel {...props} />)

    expect(screen.getByLabelText('閉じる')).toBeInTheDocument()
  })
})
