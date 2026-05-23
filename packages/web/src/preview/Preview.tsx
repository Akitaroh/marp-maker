/**
 * ZDD Atom: Atom-Preview (View, react-component)
 * Marp Markdown のレンダ結果を iframe (sandbox) で表示する。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-Preview.md
 *
 * - 内部状態: htmlString / status / errorMessage (3 個)
 * - debounce 300ms + AbortController で cancellation
 * - iframe sandbox="allow-same-origin" のみ (script 禁止)
 * - レンダロジックは外部委譲 (props.render、親が API 呼出を実装)
 *
 * dogfood-fix 1 (2026-05-23): mode prop 追加。
 * - 'document': bare template で全 SVG section が縦スクロール表示（ホワイトペーパー UX）
 * - 'presentation': bespoke template でページめくり（既存挙動、プレゼン UX）
 */

import { useEffect, useRef, useState } from 'react'
import styles from './Preview.module.css'

// ===== Types =====

export type PreviewStatus = 'idle' | 'rendering' | 'ready' | 'error'

/** dogfood-fix 1: 表示モード */
export type PreviewMode = 'document' | 'presentation'

/**
 * Marp レンダ関数の型。
 * 親 (App) が core/api 経由の実装を渡す。テストでは mock を渡す。
 *
 * dogfood-fix 1: 第 4 引数 `template` 追加。`mode` から決定。
 * - 'document' → 'bare' template
 * - 'presentation' → 'bespoke' template
 */
export type RenderFn = (
  markdown: string,
  themePath: string,
  signal?: AbortSignal,
  template?: 'bespoke' | 'bare'
) => Promise<string>

export interface PreviewProps {
  markdown: string
  themePath: string
  /** レンダ関数 (props として注入、親側で API endpoint or mock を実装) */
  render: RenderFn
  /** 表示モード (dogfood-fix 1, default: 'document') */
  mode?: PreviewMode
  /** モード切替通知 (任意、toolbar からの操作) */
  onModeChange?: (mode: PreviewMode) => void
  /** ズーム倍率 (0.5-2.0、default 1.0、presentation のみ意味あり) */
  zoom?: number
  /** レンダエラー通知 (任意) */
  onError?: (error: Error) => void
}

// ===== Constants =====

const DEBOUNCE_MS = 300

// ===== Component =====

export function Preview(props: PreviewProps): JSX.Element {
  const {
    markdown,
    themePath,
    render,
    mode = 'document',
    onModeChange,
    zoom = 1.0,
    onError,
  } = props

  const [htmlString, setHtmlString] = useState<string | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const template: 'bespoke' | 'bare' =
    mode === 'presentation' ? 'bespoke' : 'bare'

  useEffect(() => {
    // 前のレンダを cancel + debounce timer もクリア
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (markdown.trim().length === 0) {
      setStatus('idle')
      setHtmlString(null)
      setErrorMessage(null)
      return
    }

    setStatus('rendering')

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      abortRef.current = controller

      render(markdown, themePath, controller.signal, template)
        .then((html) => {
          if (controller.signal.aborted) return
          setHtmlString(html)
          setStatus('ready')
          setErrorMessage(null)
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return
          const err = e instanceof Error ? e : new Error(String(e))
          setStatus('error')
          setErrorMessage(err.message)
          if (onError) onError(err)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [markdown, themePath, render, onError, template])

  const handleModeChange = (newMode: PreviewMode): void => {
    if (newMode === mode) return
    if (onModeChange) onModeChange(newMode)
  }

  return (
    <div className={styles.container} data-testid="preview-container">
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>表示:</span>
        <div role="radiogroup" aria-label="プレビュー表示モード" className={styles.modeGroup}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'document'}
            onClick={() => handleModeChange('document')}
            className={
              mode === 'document'
                ? `${styles.modeButton} ${styles.modeButtonActive}`
                : styles.modeButton
            }
            data-testid="preview-mode-document"
          >
            📄 ドキュメント
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'presentation'}
            onClick={() => handleModeChange('presentation')}
            className={
              mode === 'presentation'
                ? `${styles.modeButton} ${styles.modeButtonActive}`
                : styles.modeButton
            }
            data-testid="preview-mode-presentation"
          >
            🎞 スライド
          </button>
        </div>
      </div>

      <div
        className={
          mode === 'document'
            ? `${styles.iframeWrap} ${styles.iframeWrapDocument}`
            : styles.iframeWrap
        }
        style={
          mode === 'presentation'
            ? { transform: `scale(${zoom})`, transformOrigin: 'top center' }
            : undefined
        }
      >
        {htmlString != null && (
          <iframe
            title="Marp プレビュー"
            srcDoc={htmlString}
            sandbox="allow-same-origin"
            className={
              mode === 'document'
                ? `${styles.iframe} ${styles.iframeDocument}`
                : styles.iframe
            }
          />
        )}
      </div>

      {status === 'rendering' && (
        <div
          role="status"
          aria-live="polite"
          className={styles.statusOverlay}
        >
          レンダリング中...
        </div>
      )}

      {status === 'error' && errorMessage != null && (
        <div role="alert" className={styles.errorOverlay}>
          <p className={styles.errorTitle}>レンダリングに失敗しました</p>
          <p className={styles.errorMessage}>{errorMessage}</p>
        </div>
      )}

      {status === 'idle' && htmlString == null && (
        <div className={styles.placeholder}>
          Markdown を入力するとプレビューが表示されます
        </div>
      )}
    </div>
  )
}
