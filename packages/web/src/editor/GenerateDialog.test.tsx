/**
 * ZDD Atom: Atom-GenerateDialog のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-GenerateDialog.md "検証経路" セクション
 *
 * NOTE: label「テーマ」が「テーマ」「テーマ ID」の 2 つでぶつかるため、
 * input の特定は data-testid で行う (getByLabelText だと multiple match)。
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GenerateDialog } from './GenerateDialog'

// ===== Helpers =====

function setupProps(overrides: Partial<Parameters<typeof GenerateDialog>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    ...overrides,
  }
}

// 各 input の取得 (data-testid 経由で重複回避)
function getThemeInput(): HTMLInputElement {
  return screen.getByTestId('theme-input') as HTMLInputElement
}
function getOutlineInput(): HTMLTextAreaElement {
  return screen.getByTestId('outline-input') as HTMLTextAreaElement
}
function getRequirementsInput(): HTMLTextAreaElement {
  return screen.getByTestId('requirements-input') as HTMLTextAreaElement
}
function getSubmitButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: 'ホワイトペーパー生成を実行',
  }) as HTMLButtonElement
}

// ===== Tests =====

describe('GenerateDialog - visibility', () => {
  it('does not render when open is false', () => {
    const props = setupProps({ open: false })
    render(<GenerateDialog {...props} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open is true', () => {
    const props = setupProps({ open: true })
    render(<GenerateDialog {...props} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('ホワイトペーパーを生成')).toBeInTheDocument()
  })
})

describe('GenerateDialog - form input', () => {
  it('updates theme on input', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), 'AI 駆動')

    expect(getThemeInput().value).toBe('AI 駆動')
  })

  it('updates outline on textarea input', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    await user.type(getOutlineInput(), '課題{Enter}提案')

    expect(getOutlineInput().value).toBe('課題\n提案')
  })
})

describe('GenerateDialog - onClose triggers', () => {
  it('fires onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const props = setupProps({ onClose })
    render(<GenerateDialog {...props} />)

    await user.click(screen.getByLabelText('閉じる'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires onClose when ESC key pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const props = setupProps({ onClose })
    render(<GenerateDialog {...props} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires onClose when backdrop clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const props = setupProps({ onClose })
    render(<GenerateDialog {...props} />)

    await user.click(screen.getByTestId('dialog-backdrop'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onClose when clicking inside dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const props = setupProps({ onClose })
    render(<GenerateDialog {...props} />)

    await user.click(screen.getByRole('dialog'))

    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('GenerateDialog - submit', () => {
  it('fires onSubmit with structured GenerateInput', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const props = setupProps({ onSubmit })
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), 'AI ホワイトペーパー')
    await user.type(getOutlineInput(), '章1{Enter}章2{Enter}章3')
    await user.type(getRequirementsInput(), '日本語で')

    await user.click(getSubmitButton())

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      theme: 'AI ホワイトペーパー',
      outline: ['章1', '章2', '章3'],
      requirements: '日本語で',
      themeId: 'whitepaper-a4',
      language: 'ja',
    })
  })

  it('splits outline by newline and drops empty lines', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const props = setupProps({ onSubmit })
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), 'Test')
    await user.type(getOutlineInput(), 'A{Enter}{Enter}  B  {Enter}C')

    await user.click(getSubmitButton())

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ outline: ['A', 'B', 'C'] })
    )
  })

  it('trims theme and requirements before submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const props = setupProps({ onSubmit })
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), '  Trimmed  ')
    await user.type(getOutlineInput(), 'A')

    await user.click(getSubmitButton())

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'Trimmed' })
    )
  })
})

describe('GenerateDialog - validation', () => {
  it('disables submit button when theme is empty', () => {
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    expect(getSubmitButton()).toBeDisabled()
  })

  it('disables submit when outline is empty', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), 'Theme')
    expect(getSubmitButton()).toBeDisabled()
  })

  it('enables submit when both theme and outline are valid', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    await user.type(getThemeInput(), 'Theme')
    await user.type(getOutlineInput(), 'Chapter')

    expect(getSubmitButton()).not.toBeDisabled()
  })

  it('marks empty theme input with aria-invalid', () => {
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    expect(getThemeInput()).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('GenerateDialog - isSubmitting state', () => {
  it('disables all inputs when isSubmitting', () => {
    const props = setupProps({ isSubmitting: true })
    render(<GenerateDialog {...props} />)

    expect(getThemeInput()).toBeDisabled()
    expect(getOutlineInput()).toBeDisabled()
    expect(getRequirementsInput()).toBeDisabled()
  })

  it('shows loading text on submit button', () => {
    const props = setupProps({ isSubmitting: true })
    render(<GenerateDialog {...props} />)

    expect(screen.getByText('生成中...')).toBeInTheDocument()
  })

  it('disables close button when isSubmitting', () => {
    const props = setupProps({ isSubmitting: true })
    render(<GenerateDialog {...props} />)

    expect(screen.getByLabelText('閉じる')).toBeDisabled()
  })
})

describe('GenerateDialog - accessibility', () => {
  it('has role=dialog and aria-modal=true', () => {
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog has aria-labelledby pointing to title', () => {
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const title = document.getElementById(labelledBy!)
    expect(title).toHaveTextContent('ホワイトペーパーを生成')
  })

  it('initial focus is on the first field (theme input)', async () => {
    const props = setupProps()
    render(<GenerateDialog {...props} />)

    // useEffect の focus 設定を待つ
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(getThemeInput()).toHaveFocus()
  })
})
