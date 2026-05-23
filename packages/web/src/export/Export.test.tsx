/**
 * ZDD Atom: Atom-Export のテスト (React Testing Library)。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-Export.md "検証経路" セクション
 *
 * A5 (2026-05-22): フォーマット選択 + PDF オプションの内部 state 化に伴いテスト拡張。
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  Export,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './Export'

// 共通の sampleResult（A5 で format フィールド追加）
const sampleResult: ExportResult = {
  url: 'blob:http://localhost/abc-123',
  filename: 'whitepaper-2026-05-21.pdf',
  sizeBytes: 1_500_000,
  format: 'pdf',
}

function pptxResult(overrides: Partial<ExportResult> = {}): ExportResult {
  return {
    url: 'blob:http://localhost/p-1',
    filename: 'whitepaper.pptx',
    sizeBytes: 800_000,
    format: 'pptx',
    ...overrides,
  }
}

function pngResult(overrides: Partial<ExportResult> = {}): ExportResult {
  return {
    url: 'blob:http://localhost/i-1',
    filename: 'whitepaper.png',
    sizeBytes: 120_000,
    format: 'png',
    ...overrides,
  }
}

describe('Export - idle state', () => {
  it('renders the export button (default PDF)', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(
      screen.getByRole('button', { name: 'PDF としてエクスポート' })
    ).toBeInTheDocument()
  })

  it('button is enabled in idle state', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(screen.getByTestId('export-button')).not.toBeDisabled()
  })

  it('fires onExport with default PDF options when clicked', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledTimes(1)
    expect(onExport).toHaveBeenCalledWith({
      format: 'pdf',
      pdf: { outlines: true, notes: false },
    } satisfies ExportOptions)
  })
})

describe('Export - rendering state', () => {
  it('shows loading overlay with status role', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/生成中/)
  })

  it('disables export button + format select while rendering', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByTestId('export-button')).toBeDisabled()
    expect(screen.getByTestId('export-format-select')).toBeDisabled()
  })
})

describe('Export - ready state (dogfood-fix 2: auto-DL + inline success)', () => {
  // jsdom で <a>.click() の自動 DL trigger をモック観察するため、
  // HTMLAnchorElement.prototype.click を spy
  it('shows inline success message in ready state', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(screen.getByTestId('export-success')).toBeInTheDocument()
    expect(screen.getByTestId('export-success').textContent).toContain(
      'ダウンロード済'
    )
  })

  it('does NOT show download link (auto-DL via useEffect)', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(
      screen.queryByRole('link', { name: /ダウンロード/ })
    ).not.toBeInTheDocument()
  })

  it('does NOT show file size for small files', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(screen.queryByText(/MB/)).not.toBeInTheDocument()
  })

  it('shows file size inline when sizeBytes > 5MB', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    const largeResult: ExportResult = { ...sampleResult, sizeBytes: 6_500_000 }
    render(<Export onExport={onExport} status="ready" result={largeResult} />)

    expect(screen.getByTestId('export-success').textContent).toContain('6.5 MB')
  })

  it('triggers programmatic download on ready state (auto-DL)', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(clickSpy).toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
  })

  it('does NOT re-trigger download for same result (idempotency)', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    const { rerender } = render(
      <Export onExport={onExport} status="ready" result={sampleResult} />
    )
    rerender(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(clickSpy).toHaveBeenCalledTimes(1)  // 1 回のみ
    clickSpy.mockRestore()
  })

  it('triggers download again when result.url changes', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    const { rerender } = render(
      <Export onExport={onExport} status="ready" result={sampleResult} />
    )
    const secondResult: ExportResult = {
      ...sampleResult,
      url: 'blob:http://localhost/xyz-456',
    }
    rerender(<Export onExport={onExport} status="ready" result={secondResult} />)

    expect(clickSpy).toHaveBeenCalledTimes(2)
    clickSpy.mockRestore()
  })

  it('success inline label adapts to format (PPTX)', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(
      <Export onExport={onExport} status="ready" result={pptxResult()} />
    )

    // aria-label に "PPTX をダウンロードしました" が含まれる
    const success = screen.getByTestId('export-success')
    expect(success.getAttribute('aria-label')).toContain('PPTX')
  })
})

describe('Export - error state', () => {
  it('shows error box with alert role', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(
      <Export
        onExport={onExport}
        status="error"
        errorMessage="Network failure"
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Network failure')).toBeInTheDocument()
  })

  it('shows fallback message when errorMessage is missing', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="error" />)

    expect(screen.getByText(/エクスポートに失敗/)).toBeInTheDocument()
  })

  it('retry button fires onExport again', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(
      <Export onExport={onExport} status="error" errorMessage="X" />
    )

    await user.click(
      screen.getByRole('button', { name: 'エクスポートを再試行' })
    )

    expect(onExport).toHaveBeenCalledTimes(1)
  })
})

describe('Export - format selector (A5)', () => {
  it('initial format is pdf', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    const sel = screen.getByTestId('export-format-select') as HTMLSelectElement
    expect(sel.value).toBe('pdf')
  })

  it('shows PDF options when pdf is selected', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(screen.getByTestId('export-pdf-options')).toBeInTheDocument()
    expect(screen.getByTestId('export-pdf-outlines')).toBeInTheDocument()
    expect(screen.getByTestId('export-pdf-notes')).toBeInTheDocument()
  })

  it('hides PDF options when pptx is selected', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(pptxResult())
    render(<Export onExport={onExport} status="idle" />)

    await user.selectOptions(screen.getByTestId('export-format-select'), 'pptx')

    expect(screen.queryByTestId('export-pdf-options')).not.toBeInTheDocument()
  })

  it('hides PDF options when png is selected', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(pngResult())
    render(<Export onExport={onExport} status="idle" />)

    await user.selectOptions(screen.getByTestId('export-format-select'), 'png')

    expect(screen.queryByTestId('export-pdf-options')).not.toBeInTheDocument()
  })

  it('hides pptx option when pptxEnabled is false', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(
      <Export onExport={onExport} status="idle" pptxEnabled={false} />
    )

    const sel = screen.getByTestId('export-format-select') as HTMLSelectElement
    const options = Array.from(sel.options).map((o) => o.value)
    expect(options).toEqual(['pdf', 'png'])
  })

  it('shows pptx option when pptxEnabled is true (default)', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    const sel = screen.getByTestId('export-format-select') as HTMLSelectElement
    const options = Array.from(sel.options).map((o) => o.value)
    expect(options).toEqual(['pdf', 'pptx', 'png'])
  })
})

describe('Export - PDF options (A5)', () => {
  it('default: outlines=true, notes=false', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledWith({
      format: 'pdf',
      pdf: { outlines: true, notes: false },
    } satisfies ExportOptions)
  })

  it('toggling outlines off reflects in onExport', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    await user.click(screen.getByTestId('export-pdf-outlines'))  // toggle off
    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledWith({
      format: 'pdf',
      pdf: { outlines: false, notes: false },
    } satisfies ExportOptions)
  })

  it('toggling notes on reflects in onExport', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    await user.click(screen.getByTestId('export-pdf-notes'))  // toggle on
    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledWith({
      format: 'pdf',
      pdf: { outlines: true, notes: true },
    } satisfies ExportOptions)
  })
})

describe('Export - format selection + onExport (A5)', () => {
  it('exports as pptx when selected', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(pptxResult())
    render(<Export onExport={onExport} status="idle" />)

    await user.selectOptions(screen.getByTestId('export-format-select'), 'pptx')
    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledWith({ format: 'pptx' } satisfies ExportOptions)
  })

  it('exports as png when selected', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(pngResult())
    render(<Export onExport={onExport} status="idle" />)

    await user.selectOptions(screen.getByTestId('export-format-select'), 'png')
    await user.click(screen.getByTestId('export-button'))

    expect(onExport).toHaveBeenCalledWith({ format: 'png' } satisfies ExportOptions)
  })

  it('format-specific button label changes', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(pptxResult())
    render(<Export onExport={onExport} status="idle" />)

    expect(screen.getByText('PDF エクスポート')).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('export-format-select'), 'pptx')

    expect(screen.getByText('PPTX エクスポート')).toBeInTheDocument()
  })
})

describe('Export - accessibility', () => {
  it('export button has dynamic aria-label by format', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(
      screen.getByLabelText('PDF としてエクスポート')
    ).toBeInTheDocument()

    await user.selectOptions(
      screen.getByTestId('export-format-select'),
      'pptx' satisfies ExportFormat
    )

    expect(
      screen.getByLabelText('PPTX としてエクスポート')
    ).toBeInTheDocument()
  })

  it('progress has aria-live=polite', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
