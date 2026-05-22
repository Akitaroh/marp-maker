/**
 * ZDD Atom: Atom-Editor (View, react-component)
 * Marp Markdown を編集する textarea + Generate/Validate ボタン (薄いシェル)。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-Editor.md
 *
 * - 内部状態 0 (controlled textarea、すべて props 駆動)
 * - 「Generate」「Validate」はトリガーのみ、実体は親に委譲
 * - Tab で `\t` 挿入 / Cmd+S で Validate ショートカット
 * - aria-label を toolbar / buttons / textarea に設定
 */

import {
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import styles from './Editor.module.css'

// ===== Types =====

export interface EditorProps {
  markdown: string
  onChange: (next: string) => void
  onOpenGenerate: () => void
  onValidate: () => void
  isValidating: boolean
  readOnly?: boolean
}

// ===== Helpers =====

function insertText(
  textarea: HTMLTextAreaElement,
  insert: string,
  currentValue: string
): { value: string; cursor: number } {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = currentValue.substring(0, start)
  const after = currentValue.substring(end)
  return {
    value: before + insert + after,
    cursor: start + insert.length,
  }
}

// ===== Component =====

export function Editor(props: EditorProps): JSX.Element {
  const {
    markdown,
    onChange,
    onOpenGenerate,
    onValidate,
    isValidating,
    readOnly = false,
  } = props

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Tab key: insert \t instead of focus move
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const textarea = e.currentTarget
      const { value, cursor } = insertText(textarea, '\t', markdown)
      onChange(value)
      // 次の render 後に caret 位置を復元
      requestAnimationFrame(() => {
        textarea.selectionStart = cursor
        textarea.selectionEnd = cursor
      })
      return
    }

    // Cmd/Ctrl + S: Validate shortcut
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && !isValidating) {
      e.preventDefault()
      onValidate()
    }
  }

  return (
    <div className={styles.container}>
      <div role="toolbar" aria-label="エディタツールバー" className={styles.toolbar}>
        <button
          type="button"
          onClick={onOpenGenerate}
          disabled={readOnly}
          aria-label="ホワイトペーパーを生成"
          className={styles.generateButton}
        >
          ✨ 生成
        </button>
        <button
          type="button"
          onClick={onValidate}
          disabled={readOnly || isValidating}
          aria-label="視覚検証を実行"
          className={styles.validateButton}
        >
          {isValidating ? '🔍 検証中...' : '🔍 検証'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        aria-label="Marp Markdown エディタ"
        spellCheck={false}
        placeholder="# タイトル&#10;&#10;Marp Markdown を入力..."
        className={styles.textarea}
        data-testid="editor-textarea"
      />
    </div>
  )
}
