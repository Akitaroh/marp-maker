/**
 * ZDD Atom: Atom-Export (View, react-component)
 * PDF エクスポートのトリガー UI + 状態表示 (pure presentation)。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-Export.md
 */

import styles from './Export.module.css'

// ===== Types =====

export type ExportStatus = 'idle' | 'rendering' | 'ready' | 'error'

export interface ExportResult {
  /** Blob URL or downloadable URL */
  url: string
  /** 推奨ファイル名 */
  filename: string
  /** ファイルサイズ (bytes) */
  sizeBytes: number
}

export interface ExportProps {
  /** PDF 生成トリガー、Promise で結果を返す */
  onExport: () => Promise<ExportResult>
  status: ExportStatus
  result?: ExportResult
  errorMessage?: string
}

// ===== Component =====

const LARGE_FILE_THRESHOLD = 5_000_000 // 5MB

/**
 * pure presentation: 内部状態なし、すべて props 駆動。
 * PDF 生成 / 状態管理 / Blob URL 作成はすべて親 (App) 責任。
 */
export function Export(props: ExportProps): JSX.Element {
  const { onExport, status, result, errorMessage } = props

  const isLoading = status === 'rendering'
  const isReady = status === 'ready' && result != null
  const isError = status === 'error'

  const handleClick = (): void => {
    void onExport()
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        aria-label="PDF としてエクスポート"
        className={styles.exportButton}
      >
        {isLoading ? 'PDF を生成中...' : 'PDF エクスポート'}
      </button>

      {isLoading && (
        <div role="status" aria-live="polite" className={styles.progress}>
          PDF を生成しています...
        </div>
      )}

      {isReady && result != null && (
        <div className={styles.downloadArea}>
          <a
            href={result.url}
            download={result.filename}
            aria-label="生成された PDF をダウンロード"
            className={styles.downloadLink}
          >
            {result.filename} をダウンロード
          </a>
          {result.sizeBytes > LARGE_FILE_THRESHOLD && (
            <div className={styles.sizeWarning}>
              ファイルサイズ: {(result.sizeBytes / 1_000_000).toFixed(1)} MB
            </div>
          )}
        </div>
      )}

      {isError && (
        <div role="alert" className={styles.errorBox}>
          <p className={styles.errorMessage}>{errorMessage ?? 'エクスポートに失敗しました'}</p>
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
