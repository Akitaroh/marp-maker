/**
 * ZDD Atom: Atom-GenerateDialog (View, react-component)
 * ホワイトペーパー生成パラメータ入力モーダル。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-GenerateDialog.md
 *
 * - 内部状態 5 個: theme / outlineRaw / requirements / themeId / language
 * - Portal で body 直下に描画
 * - ARIA: role="dialog" / aria-modal / aria-labelledby
 * - focus trap (Tab で dialog 内循環)
 * - ESC キー / 閉じるボタン / 背景クリックで close
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './GenerateDialog.module.css'

// ===== Types =====

export interface GenerateInput {
  theme: string
  outline: string[]
  requirements: string
  themeId: string
  language?: 'ja' | 'en'
}

export interface GenerateDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: GenerateInput) => void
  isSubmitting: boolean
  defaultThemeId?: string
}

// ===== Helpers =====

function splitOutline(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ===== Component =====

export function GenerateDialog(props: GenerateDialogProps): JSX.Element | null {
  const {
    open,
    onClose,
    onSubmit,
    isSubmitting,
    defaultThemeId = 'whitepaper-a4',
  } = props

  const [theme, setTheme] = useState('')
  const [outlineRaw, setOutlineRaw] = useState('')
  const [requirements, setRequirements] = useState('')
  const [themeId, setThemeId] = useState(defaultThemeId)
  const [language, setLanguage] = useState<'ja' | 'en'>('ja')

  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  // open 時の初期 focus + ESC / focus trap
  useEffect(() => {
    if (!open) return

    // 初期 focus を最初のフィールドへ
    firstFieldRef.current?.focus()

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
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
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const outline = splitOutline(outlineRaw)
  const isThemeValid = theme.trim().length > 0
  const isOutlineValid = outline.length > 0
  const isValid = isThemeValid && isOutlineValid

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault()
    if (!isValid || isSubmitting) return
    onSubmit({
      theme: theme.trim(),
      outline,
      requirements: requirements.trim(),
      themeId,
      language,
    })
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      data-testid="dialog-backdrop"
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
            ホワイトペーパーを生成
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="閉じる"
            className={styles.closeButton}
          >
            ×
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="theme-input" className={styles.label}>
              テーマ <span className={styles.required}>*</span>
            </label>
            <input
              id="theme-input"
              ref={firstFieldRef}
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={!isThemeValid}
              placeholder="例: AI 駆動開発による生産性向上"
              className={styles.input}
              data-testid="theme-input"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="outline-input" className={styles.label}>
              章立て (改行区切り) <span className={styles.required}>*</span>
            </label>
            <textarea
              id="outline-input"
              value={outlineRaw}
              onChange={(e) => setOutlineRaw(e.target.value)}
              disabled={isSubmitting}
              rows={5}
              aria-invalid={!isOutlineValid}
              placeholder="課題提起&#10;現状分析&#10;提案&#10;まとめ"
              className={styles.textarea}
              data-testid="outline-input"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="req-input" className={styles.label}>
              要件 (任意)
            </label>
            <textarea
              id="req-input"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder="例: B2B SaaS 企業向け、データドリブンな論調"
              className={styles.textarea}
              data-testid="requirements-input"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="theme-id" className={styles.label}>
                テーマ ID
              </label>
              <input
                id="theme-id"
                type="text"
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                disabled={isSubmitting}
                className={styles.input}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="lang-select" className={styles.label}>
                言語
              </label>
              <select
                id="lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'ja' | 'en')}
                disabled={isSubmitting}
                className={styles.input}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <footer className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={styles.cancelButton}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              aria-label="ホワイトペーパー生成を実行"
              className={styles.submitButton}
            >
              {isSubmitting ? '生成中...' : '生成'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  )
}
