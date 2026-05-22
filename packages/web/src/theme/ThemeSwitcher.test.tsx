/**
 * ZDD Atom: Atom-ThemeSwitcher のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-ThemeSwitcher.md "検証経路" セクション
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  ThemeSwitcher,
  type BundledThemeOption,
  type ThemeSelection,
  type ThemeSwitcherProps,
} from './ThemeSwitcher'

// ===== Helpers =====

const DEFAULT_BUNDLED: BundledThemeOption[] = [
  { themeId: 'whitepaper-a4', label: 'Whitepaper A4' },
  { themeId: 'slide-16-9', label: 'Slide 16:9' },
]

function setupProps(overrides: Partial<ThemeSwitcherProps> = {}): ThemeSwitcherProps {
  return {
    currentTheme: { kind: 'bundled', themeId: 'whitepaper-a4' },
    availableThemes: DEFAULT_BUNDLED,
    onChange: vi.fn(),
    ...overrides,
  }
}

function getSelect(): HTMLSelectElement {
  return screen.getByTestId('theme-select') as HTMLSelectElement
}

// ===== Tests =====

describe('ThemeSwitcher - rendering', () => {
  it('renders the select with available themes + Custom option', () => {
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    const select = getSelect()
    expect(select).toBeInTheDocument()
    // 2 bundled + 1 custom sentinel
    expect(select.options).toHaveLength(3)
    expect(select.options[0]!.value).toBe('whitepaper-a4')
    expect(select.options[1]!.value).toBe('slide-16-9')
    expect(select.options[2]!.textContent).toContain('カスタム')
  })

  it('shows the current bundled theme as selected', () => {
    const props = setupProps({
      currentTheme: { kind: 'bundled', themeId: 'slide-16-9' },
    })
    render(<ThemeSwitcher {...props} />)

    expect(getSelect().value).toBe('slide-16-9')
  })

  it('shows custom sentinel as selected when current theme is custom', () => {
    const props = setupProps({
      currentTheme: {
        kind: 'custom',
        cssContent: '/* @theme custom */\n/* @size A4 793px 1122px */',
      },
    })
    render(<ThemeSwitcher {...props} />)

    expect(getSelect().value).toBe('__custom__')
  })

  it('shows the 編集 button when current theme is custom', () => {
    const props = setupProps({
      currentTheme: {
        kind: 'custom',
        cssContent: '/* @theme c */\n/* @size A4 793px 1122px */',
      },
    })
    render(<ThemeSwitcher {...props} />)

    expect(screen.getByTestId('theme-edit-custom')).toBeInTheDocument()
  })

  it('does not show the 編集 button when current theme is bundled', () => {
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    expect(screen.queryByTestId('theme-edit-custom')).not.toBeInTheDocument()
  })
})

describe('ThemeSwitcher - bundled selection', () => {
  it('calls onChange with bundled selection when changing select', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = setupProps({ onChange })
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), 'slide-16-9')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      kind: 'bundled',
      themeId: 'slide-16-9',
    } satisfies ThemeSelection)
  })
})

describe('ThemeSwitcher - custom CSS modal', () => {
  it('opens the modal when selecting カスタム CSS...', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.selectOptions(getSelect(), '__custom__')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('theme-css-textarea')).toBeInTheDocument()
  })

  it('initializes the textarea empty when previously bundled', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')

    const textarea = screen.getByTestId('theme-css-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('initializes the textarea with existing custom CSS when editing', async () => {
    const user = userEvent.setup()
    const existing = '/* @theme my-existing */\n/* @size A4 793px 1122px */\nsection { color: red; }'
    const props = setupProps({
      currentTheme: { kind: 'custom', cssContent: existing },
    })
    render(<ThemeSwitcher {...props} />)

    await user.click(screen.getByTestId('theme-edit-custom'))

    await waitFor(() => {
      const textarea = screen.getByTestId('theme-css-textarea') as HTMLTextAreaElement
      expect(textarea.value).toBe(existing)
    })
  })

  it('applies the custom CSS on 適用 click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = setupProps({ onChange })
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')
    const textarea = screen.getByTestId('theme-css-textarea')
    // userEvent.type は { } を special key descriptor として扱うので、
    // 実装内容と等価な test では fireEvent / paste で literal を入れる
    await user.click(textarea)
    await user.paste(
      '/* @theme test */ /* @size A4 793px 1122px */ section { background: white; }'
    )
    await user.click(screen.getByTestId('theme-apply'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const call = onChange.mock.calls[0]![0] as ThemeSelection
    expect(call.kind).toBe('custom')
    if (call.kind === 'custom') {
      expect(call.cssContent).toContain('@theme test')
    }
  })

  it('closes modal on 適用 click', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')
    await user.click(screen.getByTestId('theme-css-textarea'))
    await user.paste(
      '/* @theme x */ /* @size A4 1px 1px */ section { color: red; }'
    )
    await user.click(screen.getByTestId('theme-apply'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not call onChange on キャンセル click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const props = setupProps({ onChange })
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')
    await user.click(screen.getByTestId('theme-css-textarea'))
    await user.paste('discarded')
    await user.click(screen.getByTestId('theme-cancel'))

    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('disables 適用 button when textarea is empty', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')

    const applyBtn = screen.getByTestId('theme-apply') as HTMLButtonElement
    expect(applyBtn.disabled).toBe(true)
  })

  it('closes modal on Escape key', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes modal on backdrop click', async () => {
    const user = userEvent.setup()
    const props = setupProps()
    render(<ThemeSwitcher {...props} />)

    await user.selectOptions(getSelect(), '__custom__')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('theme-modal-backdrop'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
