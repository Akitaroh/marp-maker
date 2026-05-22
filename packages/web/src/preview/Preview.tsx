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
 */

import { useEffect, useRef, useState } from 'react'
import styles from './Preview.module.css'

// ===== Types =====

export type PreviewStatus = 'idle' | 'rendering' | 'ready' | 'error'

/**
 * Marp レンダ関数の型。
 * 親 (App) が core/api 経由の実装を渡す。テストでは mock を渡す。
 */
export type RenderFn = (
  markdown: string,
  themePath: string,
  signal?: AbortSignal
) => Promise<string>

export interface PreviewProps {
  markdown: string
  themePath: string
  /** レンダ関数 (props として注入、親側で API endpoint or mock を実装) */
  render: RenderFn
  /** ズーム倍率 (0.5-2.0、default 1.0) */
  zoom?: number
  /** レンダエラー通知 (任意) */
  onError?: (error: Error) => void
}

// ===== Constants =====

const DEBOUNCE_MS = 300

// ===== Component =====

export function Preview(props: PreviewProps): JSX.Element {
  const { markdown, themePath, render, zoom = 1.0, onError } = props

  const [htmlString, setHtmlString] = useState<string | null>(null)
  const [status, setStatus] = useState<PreviewStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      render(markdown, themePath, controller.signal)
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
  }, [markdown, themePath, render, onError])

  return (
    <div className={styles.container} data-testid="preview-container">
      <div
        className={styles.iframeWrap}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        {htmlString != null && (
          <iframe
            title="Marp プレビュー"
            srcDoc={htmlString}
            sandbox="allow-same-origin"
            className={styles.iframe}
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
