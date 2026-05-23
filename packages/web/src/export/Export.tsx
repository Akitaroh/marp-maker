/**
 * ZDD Atom: Atom-Export (View, react-component)
 * PDF / PPTX / PNG エクスポートのトリガー UI + 状態表示。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-Export.md
 *
 * A5 (2026-05-22): フォーマット選択 + PDF オプションを内部 state 化。
 * - selectedFormat: 'pdf' | 'pptx' | 'png'
 * - pdfOutlines: boolean
 * - pdfNotes: boolean
 */

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import styles from './Export.module.css'

// ===== Types =====

export type ExportFormat = 'pdf' | 'pptx' | 'png'
export type ExportStatus = 'idle' | 'rendering' | 'ready' | 'error'

export interface PdfOptions {
  outlines: boolean
  notes: boolean
}

export interface ExportOptions {
  format: ExportFormat
  pdf?: PdfOptions  // format === 'pdf' のときのみ
}

export interface ExportResult {
  /** Blob URL or downloadable URL */
  url: string
  /** 推奨ファイル名 */
  filename: string
  /** ファイルサイズ (bytes) */
  sizeBytes: number
  /** A5: どのフォーマットで出力されたか */
  format: ExportFormat
}

export interface ExportProps {
  /** Export 開始、選択中の format + options を渡す */
  onExport: (opts: ExportOptions) => Promise<ExportResult>
  status: ExportStatus
  result?: ExportResult
  errorMessage?: string
  /** PPTX 機能の表示制御。LibreOffice 非搭載環境では false で hidden 化 */
  pptxEnabled?: boolean
}

// ===== Component =====

const LARGE_FILE_THRESHOLD = 5_000_000 // 5MB

const FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: 'PDF',
  pptx: 'PPTX',
  png: 'PNG (先頭ページ)',
}

const BUTTON_LABEL_LOADING: Record<ExportFormat, string> = {
  pdf: 'PDF を生成中...',
  pptx: 'PPTX を生成中...',
  png: 'PNG を生成中...',
}

const BUTTON_LABEL_IDLE: Record<ExportFormat, string> = {
  pdf: 'PDF エクスポート',
  pptx: 'PPTX エクスポート',
  png: 'PNG エクスポート',
}

export function Export(props: ExportProps): JSX.Element {
  const { onExport, status, result, errorMessage, pptxEnabled = true } = props

  // A5: 内部 state
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [pdfOutlines, setPdfOutlines] = useState<boolean>(true)
  const [pdfNotes, setPdfNotes] = useState<boolean>(false)

  // dogfood-fix 2 (2026-05-23): 自動 DL trigger の冪等性のため、最後にトリガした result の identity (url) を記憶
  const lastTriggeredUrlRef = useRef<string | null>(null)

  const isLoading = status === 'rendering'
  const isReady = status === 'ready' && result != null
  const isError = status === 'error'

  // dogfood-fix 2: ready 状態になったら自動でダウンロード trigger
  // ヘッダーレイアウト崩れを避けるため、リンク表示ではなく programmatic click
  useEffect(() => {
    if (!isReady || result == null) return
    if (lastTriggeredUrlRef.current === result.url) return  // 多重実行回避
    lastTriggeredUrlRef.current = result.url

    const a = document.createElement('a')
    a.href = result.url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Note: result.url (Blob URL) の revokeObjectURL は親 (App) の責務
  }, [isReady, result])

  const handleFormatChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedFormat(e.target.value as ExportFormat)
  }

  const buildOptions = (): ExportOptions => {
    if (selectedFormat === 'pdf') {
      return {
        format: 'pdf',
        pdf: { outlines: pdfOutlines, notes: pdfNotes },
      }
    }
    return { format: selectedFormat }
  }

  const handleClick = (): void => {
    void onExport(buildOptions())
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <label htmlFor="export-format" className={styles.label}>
          形式:
        </label>
        <select
          id="export-format"
          value={selectedFormat}
          onChange={handleFormatChange}
          disabled={isLoading}
          className={styles.formatSelect}
          data-testid="export-format-select"
        >
          <option value="pdf">{FORMAT_LABEL.pdf}</option>
          {pptxEnabled && <option value="pptx">{FORMAT_LABEL.pptx}</option>}
          <option value="png">{FORMAT_LABEL.png}</option>
        </select>

        {selectedFormat === 'pdf' && (
          <div className={styles.pdfOptions} data-testid="export-pdf-options">
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={pdfOutlines}
                onChange={(e) => setPdfOutlines(e.target.checked)}
                disabled={isLoading}
                data-testid="export-pdf-outlines"
              />
              目次
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={pdfNotes}
                onChange={(e) => setPdfNotes(e.target.checked)}
                disabled={isLoading}
                data-testid="export-pdf-notes"
              />
              Speaker notes
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          aria-label={`${FORMAT_LABEL[selectedFormat]} としてエクスポート`}
          className={styles.exportButton}
          data-testid="export-button"
        >
          {isLoading
            ? BUTTON_LABEL_LOADING[selectedFormat]
            : BUTTON_LABEL_IDLE[selectedFormat]}
        </button>
      </div>

      {isLoading && (
        <div role="status" aria-live="polite" className={styles.progress}>
          {BUTTON_LABEL_LOADING[selectedFormat]}
        </div>
      )}

      {/* dogfood-fix 2: ready 状態の表示を inline success に変更
          自動 DL は useEffect 経由、UI はステータス表示のみ */}
      {isReady && result != null && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`生成された ${FORMAT_LABEL[result.format]} をダウンロードしました`}
          className={styles.successInline}
          data-testid="export-success"
        >
          ✓ ダウンロード済
          {result.sizeBytes > LARGE_FILE_THRESHOLD &&
            ` (${(result.sizeBytes / 1_000_000).toFixed(1)} MB)`}
        </div>
      )}

      {isError && (
        <div role="alert" className={styles.errorBox}>
          <p className={styles.errorMessage}>
            {errorMessage ?? 'エクスポートに失敗しました'}
          </p>
          <button
            type="button"
            onClick={handleClick}
            aria-label="エクスポートを再試行"
            className={styles.retryButton}
          >
            再試行
          </button>
        </div>
      )}
    </div>
  )
}
