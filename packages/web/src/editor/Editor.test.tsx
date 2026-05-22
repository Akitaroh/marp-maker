/**
 * ZDD Atom: Atom-Editor のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-Editor.md "検証経路" セクション
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Editor } from './Editor'

// ===== Helpers =====

function setupProps(overrides: Partial<Parameters<typeof Editor>[0]> = {}) {
  return {
    markdown: '',
    onChange: vi.fn(),
    onOpenGenerate: vi.fn(),
    onValidate: vi.fn(),
    isValidating: false,
    ...overrides,
  }
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('editor-textarea') as HTMLTextAreaElement
}

function getGenerateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'ホワイトペーパーを生成' }) as HTMLButtonElement
}

function getValidateButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: '視覚検証を実行' }) as HTMLButtonElement
}

// ===== Tests =====

describe('Editor - rendering', () => {
  it('renders textarea with markdown value', () => {
    const props = setupProps({ markdown: '# Hello' })
    render(<Editor {...props} />)

    expect(getTextarea().value).toBe('# Hello')
  })

  it('renders Generate button', () => {
    const props = setupProps()
    render(<Editor {...props} />)

    expect(getGenerateButton()).toBeInTheDocument()
  })

  it('renders Validate button', () => {
    const props = setupProps()
    render(<Editor {...props} />)

    expect(getValidateButton()).toBeInTheDocument()
  })
})

describe('Editor - onChange', () => {
  it('fires onChange with new string on typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = setupProps({ onChange })
    render(<Editor {...props} />)

    await user.type(getTextarea(), 'X')

    expect(onChange).toHaveBeenCalledWith('X')
  })
})

describe('Editor - Generate button', () => {
  it('fires onOpenGenerate when clicked', async () => {
    const user = userEvent.setup()
    const onOpenGenerate = vi.fn()
    const props = setupProps({ onOpenGenerate })
    render(<Editor {...props} />)

    await user.click(getGenerateButton())

    expect(onOpenGenerate).toHaveBeenCalledTimes(1)
  })

  it('is disabled when readOnly', () => {
    const props = setupProps({ readOnly: true })
    render(<Editor {...props} />)

    expect(getGenerateButton()).toBeDisabled()
  })
})

describe('Editor - Validate button', () => {
  it('fires onValidate when clicked', async () => {
    const user = userEvent.setup()
    const onValidate = vi.fn()
    const props = setupProps({ onValidate })
    render(<Editor {...props} />)

    await user.click(getValidateButton())

    expect(onValidate).toHaveBeenCalledTimes(1)
  })

  it('shows loading label when isValidating', () => {
    const props = setupProps({ isValidating: true })
    render(<Editor {...props} />)

    expect(screen.getByText(/検証中/)).toBeInTheDocument()
  })

  it('is disabled when isValidating', () => {
    const props = setupProps({ isValidating: true })
    render(<Editor {...props} />)

    expect(getValidateButton()).toBeDisabled()
  })
})

describe('Editor - readOnly mode', () => {
  it('textarea is readOnly when prop is true', () => {
    const props = setupProps({ readOnly: true, markdown: 'locked' })
    render(<Editor {...props} />)

    expect(getTextarea()).toHaveAttribute('readonly')
  })
})

describe('Editor - keyboard shortcuts', () => {
  it('Tab key inserts \\t into textarea', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = setupProps({ onChange, markdown: 'abc' })
    render(<Editor {...props} />)

    const textarea = getTextarea()
    // カーソルを末尾へ
    textarea.focus()
    textarea.setSelectionRange(3, 3)

    await user.keyboard('{Tab}')

    expect(onChange).toHaveBeenCalledWith('abc\t')
  })

  it('Cmd+S triggers onValidate (Mac)', async () => {
    const user = userEvent.setup()
    const onValidate = vi.fn()
    const props = setupProps({ onValidate })
    render(<Editor {...props} />)

    getTextarea().focus()
    await user.keyboard('{Meta>}s{/Meta}')

    expect(onValidate).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+S triggers onValidate (Windows/Linux)', async () => {
    const user = userEvent.setup()
    const onValidate = vi.fn()
    const props = setupProps({ onValidate })
    render(<Editor {...props} />)

    getTextarea().focus()
    await user.keyboard('{Control>}s{/Control}')

    expect(onValidate).toHaveBeenCalledTimes(1)
  })

  it('Cmd+S does NOT trigger onValidate when isValidating', async () => {
    const user = userEvent.setup()
    const onValidate = vi.fn()
    const props = setupProps({ onValidate, isValidating: true })
    render(<Editor {...props} />)

    getTextarea().focus()
    await user.keyboard('{Meta>}s{/Meta}')

    expect(onValidate).not.toHaveBeenCalled()
  })
})

describe('Editor - accessibility', () => {
  it('toolbar has role and aria-label', () => {
    const props = setupProps()
    render(<Editor {...props} />)

    expect(screen.getByRole('toolbar')).toHaveAttribute(
      'aria-label',
      'エディタツールバー'
    )
  })

  it('textarea has aria-label', () => {
    const props = setupProps()
    render(<Editor {...props} />)

    expect(getTextarea()).toHaveAttribute('aria-label', 'Marp Markdown エディタ')
  })
})
