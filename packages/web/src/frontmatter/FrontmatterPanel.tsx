/**
 * ZDD Atom: Atom-FrontmatterPanel (View, react-component)
 * Marp frontmatter の各フィールドを form で編集するモーダル UI。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-FrontmatterPanel.md
 *
 * 内部状態: draft (FrontmatterValues) — モーダル内編集中の値、apply で親に伝達、cancel で破棄
 * モーダルパターンは Atom-GenerateDialog / Atom-ThemeSwitcher と統一（createPortal + focus trap +
 * Esc / overlay close + useId）。
 */

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import styles from './FrontmatterPanel.module.css'
import {
  SIZE_PRESETS,
  type FrontmatterValues,
  type SizePreset,
} from './frontmatter-codec'

// ===== Types =====

export type { FrontmatterValues, SizePreset } from './frontmatter-codec'

export interface FrontmatterPanelProps {
  open: boolean
  values: FrontmatterValues
  onApply: (next: FrontmatterValues) => void
  onClose: () => void
}

// ===== 内部定数: size プリセットの表示用ラベル =====

const SIZE_LABEL: Record<SizePreset, string> = {
  A4: 'A4 縦 (793×1122)',
  '16-9': '16:9 スライド (1280×720)',
  '4-3': '4:3 スライド (1280×960)',
  Letter: 'Letter (816×1056)',
}

// 「未設定」を表す sentinel
const SIZE_UNSET_SENTINEL = '__unset__'

// ===== Helpers =====

/**
 * draft → onApply に渡す FrontmatterValues に正規化。
 * - text フィールド: 空文字は undefined にせず空文字のまま渡す（明示的に空を保持）
 *   ※ 完全に削除したい場合は親側で別途処理
 * - size: '__unset__' は undefined に変換
 */
function buildApplyValues(draft: FrontmatterValues & { sizeRaw: string }): FrontmatterValues {
  const { sizeRaw, ...rest } = draft
  const result: FrontmatterValues = { ...rest }
  if (sizeRaw === SIZE_UNSET_SENTINEL) {
    result.size = undefined
  } else {
    result.size = sizeRaw as SizePreset
  }
  return result
}

// ===== Component =====

export function FrontmatterPanel(props: FrontmatterPanelProps): JSX.Element | null {
  const { open, values, onApply, onClose } = props

  // 内部 draft: sizeRaw を string 化（'__unset__' or SizePreset）して select 制御
  const [draft, setDraft] = useState<FrontmatterValues & { sizeRaw: string }>(
    () => initDraft(values)
  )

  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const titleId = useId()

  // open になるたび新 values で draft 再初期化
  useEffect(() => {
    if (!open) return
    setDraft(initDraft(values))
  }, [open, values])

  // モーダル open 時の動作: focus + Esc / focus trap
  useEffect(() => {
    if (!open) return

    const t = setTimeout(() => firstFieldRef.current?.focus(), 0)

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

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
  }, [open, onClose])

  if (!open) return null

  const handleApply = (): void => {
    onApply(buildApplyValues(draft))
    onClose()
  }

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      data-testid="frontmatter-modal-backdrop"
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
            Frontmatter 設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className={styles.closeButton}
          >
            ×
          </button>
        </header>

        <div className={styles.body}>
          {/* size */}
          <div className={styles.field}>
            <label htmlFor="fm-size" className={styles.label}>
              サイズ
            </label>
            <select
              id="fm-size"
              ref={firstFieldRef}
              value={draft.sizeRaw}
              onChange={(e) => setDraft({ ...draft, sizeRaw: e.target.value })}
              className={styles.select}
              data-testid="fm-size"
            >
              <option value={SIZE_UNSET_SENTINEL}>未設定（テーマに従う）</option>
              {SIZE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {SIZE_LABEL[preset]}
                </option>
              ))}
            </select>
            <p className={styles.hint}>
              カスタムサイズが必要な場合はテーマ選択でカスタム CSS を持ち込んでください。
            </p>
          </div>

          {/* title */}
          <div className={styles.field}>
            <label htmlFor="fm-title" className={styles.label}>
              タイトル
            </label>
            <input
              id="fm-title"
              type="text"
              value={draft.title ?? ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={styles.input}
              placeholder="ホワイトペーパーのタイトル"
              data-testid="fm-title"
            />
          </div>

          {/* author */}
          <div className={styles.field}>
            <label htmlFor="fm-author" className={styles.label}>
              著者
            </label>
            <input
              id="fm-author"
              type="text"
              value={draft.author ?? ''}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              className={styles.input}
              placeholder="例: アキタロウ"
              data-testid="fm-author"
            />
          </div>

          {/* description */}
          <div className={styles.field}>
            <label htmlFor="fm-description" className={styles.label}>
              説明
            </label>
            <textarea
              id="fm-description"
              value={draft.description ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              rows={2}
              className={styles.textarea}
              placeholder="ホワイトペーパーの概要"
              data-testid="fm-description"
            />
          </div>

          {/* header */}
          <div className={styles.field}>
            <label htmlFor="fm-header" className={styles.label}>
              ヘッダー（全ページ）
            </label>
            <input
              id="fm-header"
              type="text"
              value={draft.header ?? ''}
              onChange={(e) => setDraft({ ...draft, header: e.target.value })}
              className={styles.input}
              placeholder="例: **会社名** | 部署"
              data-testid="fm-header"
            />
            <p className={styles.hint}>markdown 記法可（**bold** / *italic*）</p>
          </div>

          {/* footer */}
          <div className={styles.field}>
            <label htmlFor="fm-footer" className={styles.label}>
              フッター（全ページ）
            </label>
            <input
              id="fm-footer"
              type="text"
              value={draft.footer ?? ''}
              onChange={(e) => setDraft({ ...draft, footer: e.target.value })}
              className={styles.input}
              placeholder="例: Confidential / 2026"
              data-testid="fm-footer"
            />
          </div>

          {/* paginate */}
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={draft.paginate ?? false}
                onChange={(e) =>
                  setDraft({ ...draft, paginate: e.target.checked })
                }
                data-testid="fm-paginate"
              />
              ページ番号を表示する (paginate)
            </label>
          </div>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            data-testid="fm-cancel"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={styles.applyButton}
            data-testid="fm-apply"
          >
            適用
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

// ===== Helpers =====

function initDraft(
  values: FrontmatterValues
): FrontmatterValues & { sizeRaw: string } {
  return {
    ...values,
    sizeRaw: values.size ?? SIZE_UNSET_SENTINEL,
  }
}
