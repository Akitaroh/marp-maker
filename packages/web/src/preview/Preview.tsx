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

  // dogfood-fix 1 続編: iframe ref + auto-height for document mode
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  /**
   * document mode で srcdoc に注入する style:
   * - body bg を明るくしてダーク背景を消す
   * - SVG section 間に margin
   * - body overflow visible (親側 wrap で scroll)
   */
  const DOCUMENT_INJECT_STYLE = `
    <style>
      html, body {
        background: #f5f5f5 !important;
        margin: 0 !important;
        padding: 16px !important;
        overflow: visible !important;
        height: auto !important;
      }
      svg[data-marpit-svg] {
        display: block;
        margin: 0 auto 16px;
        max-width: 100%;
        height: auto;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        background: white;
      }
    </style>
  `

  /**
   * document mode は HTML の <head> 末尾に style を inject
   * bespoke (presentation) では何もしない（既存挙動維持）
   */
  const effectiveSrcDoc =
    htmlString != null && mode === 'document'
      ? htmlString.replace('</head>', `${DOCUMENT_INJECT_STYLE}</head>`)
      : htmlString

  /**
   * iframe load 時の処理（mode 別）
   *
   * document mode:
   * 1. body.scrollHeight に合わせて iframe height を auto-fit
   * 2. iframe 内の wheel event を親 wrap に forward
   *    (iframe は wheel event を吸収するため、明示的に親側 scroll をトリガする)
   *
   * presentation mode:
   * - iframe.style.height を解除（CSS の default に戻す = 1122px 等の slide サイズ）
   * - bespoke template は自前で 1 ページずつ管理するので height auto-fit 不要
   */
  const handleIframeLoad = (): void => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return

    if (mode === 'presentation') {
      // dogfood-fix 1 続編 2: document mode で設定した style.height を解除
      // これがないと slide mode 切替時も 2912px のまま縦長になる
      iframe.style.height = ''
      return
    }

    // mode === 'document':

    // (1) auto-fit height
    const contentHeight = iframe.contentDocument.body.scrollHeight
    if (contentHeight > 0) {
      iframe.style.height = `${contentHeight + 20}px`
    }

    // (2) wheel event forwarding (iframe → 親 wrap)
    const wrap = iframe.parentElement
    if (!wrap) return
    const iframeDoc = iframe.contentDocument
    const handleWheel = (e: WheelEvent): void => {
      // 親 wrap を scroll、iframe 内部スクロールは抑止
      e.preventDefault()
      wrap.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' })
    }
    iframeDoc.addEventListener('wheel', handleWheel, { passive: false })
    // cleanup は次回 onLoad で別 doc になるので不要（古い iframeDoc は GC される）
  }

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
        {effectiveSrcDoc != null && (
          <iframe
            ref={iframeRef}
            title="Marp プレビュー"
            srcDoc={effectiveSrcDoc}
            sandbox="allow-same-origin"
            onLoad={handleIframeLoad}
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
