/**
 * ZDD Atom: Atom-Export のテスト (React Testing Library)。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-Export.md "検証経路" セクション
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Export, type ExportResult } from './Export'

const sampleResult: ExportResult = {
  url: 'blob:http://localhost/abc-123',
  filename: 'whitepaper-2026-05-21.pdf',
  sizeBytes: 1_500_000,
}

describe('Export - idle state', () => {
  it('renders the export button', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(
      screen.getByRole('button', { name: 'PDF としてエクスポート' })
    ).toBeInTheDocument()
  })

  it('button is enabled in idle state', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(
      screen.getByRole('button', { name: 'PDF としてエクスポート' })
    ).not.toBeDisabled()
  })

  it('fires onExport when button clicked', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    await user.click(
      screen.getByRole('button', { name: 'PDF としてエクスポート' })
    )

    expect(onExport).toHaveBeenCalledTimes(1)
  })
})

describe('Export - rendering state', () => {
  it('shows loading overlay with status role', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/生成しています/)
  })

  it('disables button while rendering', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('Export - ready state', () => {
  it('shows download link with correct href and download attribute', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    const link = screen.getByRole('link', { name: '生成された PDF をダウンロード' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', sampleResult.url)
    expect(link).toHaveAttribute('download', sampleResult.filename)
  })

  it('does NOT show size warning for small files', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(screen.queryByText(/MB/)).not.toBeInTheDocument()
  })

  it('shows large file warning when sizeBytes > 5MB', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    const largeResult: ExportResult = {
      ...sampleResult,
      sizeBytes: 6_500_000,
    }
    render(<Export onExport={onExport} status="ready" result={largeResult} />)

    expect(screen.getByText(/6\.5 MB/)).toBeInTheDocument()
  })
})

describe('Export - error state', () => {
  it('shows error box with alert role', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(
      <Export onExport={onExport} status="error" errorMessage="Network failure" />
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
    render(<Export onExport={onExport} status="error" errorMessage="X" />)

    await user.click(screen.getByRole('button', { name: 'エクスポートを再試行' }))

    expect(onExport).toHaveBeenCalledTimes(1)
  })
})

describe('Export - accessibility', () => {
  it('export button has aria-label', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="idle" />)

    expect(
      screen.getByLabelText('PDF としてエクスポート')
    ).toBeInTheDocument()
  })

  it('download link has aria-label', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="ready" result={sampleResult} />)

    expect(
      screen.getByLabelText('生成された PDF をダウンロード')
    ).toBeInTheDocument()
  })

  it('progress has aria-live=polite', () => {
    const onExport = vi.fn().mockResolvedValue(sampleResult)
    render(<Export onExport={onExport} status="rendering" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
