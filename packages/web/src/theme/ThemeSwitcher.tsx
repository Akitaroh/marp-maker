/**
 * ZDD Atom: Atom-ThemeSwitcher (View, react-component)
 * Marp テーマの選択（バンドル / カスタム CSS 持込）UI。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-ThemeSwitcher.md
 *
 * - 内部状態 2 個: isModalOpen / draftCssContent
 * - Portal で body 直下にモーダル描画（GenerateDialog と同パターン）
 * - ARIA: role="dialog" / aria-modal / aria-labelledby
 * - focus trap (Tab で dialog 内循環)
 * - ESC / 閉じるボタン / 背景クリックで close
 *
 * CSS の妥当性検証は本 Atom の責務外（Atom-ThemeLoader が validate）。
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './ThemeSwitcher.module.css'

// ===== Types =====

export type ThemeSelection =
  | { kind: 'bundled'; themeId: string }
  | { kind: 'custom'; cssContent: string }

export interface BundledThemeOption {
  themeId: string
  label: string
}

export interface ThemeSwitcherProps {
  /** 現在選択中のテーマ */
  currentTheme: ThemeSelection
  /** ドロップダウンに表示するバンドルテーマ一覧 */
  availableThemes: BundledThemeOption[]
  /** テーマ選択変更時のコールバック */
  onChange: (next: ThemeSelection) => void
}

// 「カスタム...」を表すドロップダウンの sentinel 値
const CUSTOM_SENTINEL = '__custom__'

// ===== Component =====

export function ThemeSwitcher(props: ThemeSwitcherProps): JSX.Element {
  const { currentTheme, availableThemes, onChange } = props

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draftCssContent, setDraftCssContent] = useState('')

  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  // select の表示値: bundled なら themeId、custom なら sentinel
  const selectValue =
    currentTheme.kind === 'bundled' ? currentTheme.themeId : CUSTOM_SENTINEL

  // モーダル open 時の動作: textarea 初期化 + focus + Esc / focus trap
  useEffect(() => {
    if (!isModalOpen) return

    // 既存のカスタム CSS があれば編集状態で初期化
    setDraftCssContent(
      currentTheme.kind === 'custom' ? currentTheme.cssContent : ''
    )

    // 初期 focus を textarea へ（next tick で確実に focus する）
    const t = setTimeout(() => textareaRef.current?.focus(), 0)

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsModalOpen(false)
        return
      }
      if (e.key !== 'Tab') return

      // focus trap
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return

      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return (): void => {
      clearTimeout(t)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isModalOpen, currentTheme])

  // select の変更ハンドラ
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value
    if (value === CUSTOM_SENTINEL) {
      setIsModalOpen(true)
    } else {
      onChange({ kind: 'bundled', themeId: value })
    }
  }

  // モーダルの適用
  const handleApply = (): void => {
    const content = draftCssContent.trim()
    if (content.length === 0) return
    onChange({ kind: 'custom', cssContent: content })
    setIsModalOpen(false)
  }

  const handleCancel = (): void => {
    setIsModalOpen(false)
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) setIsModalOpen(false)
  }

  return (
    <div className={styles.switcher} data-testid="theme-switcher">
      <label htmlFor="theme-select" className={styles.label}>
        テーマ:
      </label>
      <select
        id="theme-select"
        value={selectValue}
        onChange={handleSelectChange}
        className={styles.select}
        data-testid="theme-select"
      >
        {availableThemes.map((t) => (
          <option key={t.themeId} value={t.themeId}>
            {t.label}
          </option>
        ))}
        <option value={CUSTOM_SENTINEL}>カスタム CSS...</option>
      </select>
      {currentTheme.kind === 'custom' && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={styles.editButton}
          data-testid="theme-edit-custom"
          aria-label="カスタム CSS を編集"
        >
          編集
        </button>
      )}

      {isModalOpen &&
        createPortal(
          <div
            className={styles.backdrop}
            onClick={handleBackdropClick}
            data-testid="theme-modal-backdrop"
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={styles.dialog}
            >
              <header className={styles.header}>
                <h2 id={titleId} className={styles.title}>
                  カスタム CSS テーマ
                </h2>
                <button
                  type="button"
                  onClick={handleCancel}
                  aria-label="閉じる"
                  className={styles.closeButton}
                >
                  ×
                </button>
              </header>

              <div className={styles.body}>
                <p className={styles.description}>
                  Marp 形式の CSS を貼り付けてください。先頭に
                  <code> /* @theme &lt;id&gt; */</code> と
                  <code> /* @size &lt;name&gt; &lt;w&gt;px &lt;h&gt;px */</code> を
                  必ず含めてください。
                </p>
                <textarea
                  ref={textareaRef}
                  value={draftCssContent}
                  onChange={(e) => setDraftCssContent(e.target.value)}
                  rows={16}
                  placeholder={`/* @theme my-custom */\n/* @size A4 793px 1122px */\nsection {\n  width: 793px;\n  height: 1122px;\n  background: #fff;\n}`}
                  className={styles.textarea}
                  data-testid="theme-css-textarea"
                  spellCheck={false}
                />
              </div>

              <footer className={styles.footer}>
                <button
                  type="button"
                  onClick={handleCancel}
                  className={styles.cancelButton}
                  data-testid="theme-cancel"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={draftCssContent.trim().length === 0}
                  className={styles.applyButton}
                  data-testid="theme-apply"
                >
                  適用
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
