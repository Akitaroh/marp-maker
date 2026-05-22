/**
 * MarpMaker web app root.
 * 5 Atom (Editor / GenerateDialog / Preview / Export / ThemeSwitcher) を統合。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/ Atom-* 各種
 *
 * API endpoint (Vite middleware) と通信:
 * - /api/generate (Claude API)
 * - /api/render   (HTML preview)
 * - /api/export   (PDF binary)
 */

import { useCallback, useState } from 'react'

import { Editor } from '../editor/Editor'
import { GenerateDialog, type GenerateInput } from '../editor/GenerateDialog'
import { Preview, type RenderFn } from '../preview/Preview'
import { Export, type ExportResult, type ExportStatus } from '../export/Export'
import {
  ThemeSwitcher,
  type BundledThemeOption,
  type ThemeSelection,
} from '../theme/ThemeSwitcher'

import styles from './App.module.css'

// ===== 定数 =====

const DEFAULT_THEME_ID = 'whitepaper-a4'

/** バンドルテーマ一覧（A3 で複数化、2026-05-22）。 */
const AVAILABLE_THEMES: BundledThemeOption[] = [
  { themeId: 'whitepaper-a4', label: 'Whitepaper A4' },
  { themeId: 'slide-16-9', label: 'Slide 16:9' },
  { themeId: 'minimal-mono', label: 'Minimal Mono (A4)' },
]

/** Preview に渡す themePath は placeholder、実 resolve は middleware 側。 */
const THEME_PATH_PLACEHOLDER = '__theme__'

const DEFAULT_MARKDOWN = `---
marp: true
theme: whitepaper-a4
size: A4
paginate: true
---

# MarpMaker へようこそ

LLM 協働でブランド完全準拠した A4 ホワイトペーパーを量産するツール。

---

## 使い方

1. 左ペインで Marp Markdown を編集
2. ✨ 生成ボタンで AI にホワイトペーパーを生成させる
3. プレビュー (右ペイン) で確認
4. 🔍 検証ボタンで視覚チェック (Phase 2)
5. 右上の **PDF エクスポート** でダウンロード

---

## 今やってること

ZDD (Zettel駆動開発) で実装中の MVP。
- M-core: ✅ 完了
- M-web: ✅ Atom 4/4 完了 + 統合動作確認中
`

// ===== Component =====

export function App(): JSX.Element {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN)
  const [currentTheme, setCurrentTheme] = useState<ThemeSelection>({
    kind: 'bundled',
    themeId: DEFAULT_THEME_ID,
  })
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportResult, setExportResult] = useState<ExportResult | undefined>(undefined)
  const [exportError, setExportError] = useState<string | undefined>(undefined)

  // ===== Preview render (called by Atom-Preview internally) =====

  const renderPreview: RenderFn = useCallback(
    async (md, _themePath, signal) => {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: md, theme: currentTheme }),
        signal,
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(err.error ?? `Render failed: ${response.status}`)
      }
      const data = (await response.json()) as { htmlString: string }
      return data.htmlString
    },
    [currentTheme]
  )

  // ===== Generate handler =====

  const handleGenerate = async (input: GenerateInput): Promise<void> => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(err.error ?? `Generate failed: ${response.status}`)
      }
      const data = (await response.json()) as { markdown: string }
      setMarkdown(data.markdown)
      setGenerateDialogOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // MVP: 簡易エラー通知。Phase 2 で Toast 等
      alert(`生成失敗: ${msg}`)
    } finally {
      setIsGenerating(false)
    }
  }

  // ===== Validate handler (MVP: stub) =====

  const handleValidate = async (): Promise<void> => {
    setIsValidating(true)
    try {
      // MVP は stub、Phase 2 で /api/validate を呼ぶ
      await new Promise((resolve) => setTimeout(resolve, 500))
      alert('視覚検証は Phase 2 で実装予定です')
    } finally {
      setIsValidating(false)
    }
  }

  // ===== Export handler =====

  const handleExport = async (): Promise<ExportResult> => {
    setExportStatus('rendering')
    setExportError(undefined)
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, theme: currentTheme }),
      })
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(err.error ?? `Export failed: ${response.status}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const ymd = new Date().toISOString().slice(0, 10)
      const hm = new Date().toTimeString().slice(0, 5).replace(':', '-')
      const filename = `whitepaper-${ymd}-${hm}.pdf`
      const result: ExportResult = { url, filename, sizeBytes: blob.size }
      setExportResult(result)
      setExportStatus('ready')
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setExportError(msg)
      setExportStatus('error')
      throw e
    }
  }

  // ===== Render =====

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>MarpMaker</h1>
        <div className={styles.themeArea}>
          <ThemeSwitcher
            currentTheme={currentTheme}
            availableThemes={AVAILABLE_THEMES}
            onChange={setCurrentTheme}
          />
        </div>
        <div className={styles.exportArea}>
          <Export
            onExport={handleExport}
            status={exportStatus}
            result={exportResult}
            errorMessage={exportError}
          />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.editorPane} aria-label="エディタ">
          <Editor
            markdown={markdown}
            onChange={setMarkdown}
            onOpenGenerate={() => setGenerateDialogOpen(true)}
            onValidate={() => void handleValidate()}
            isValidating={isValidating}
          />
        </section>

        <section className={styles.previewPane} aria-label="プレビュー">
          <Preview
            markdown={markdown}
            themePath={THEME_PATH_PLACEHOLDER}
            render={renderPreview}
          />
        </section>
      </main>

      <GenerateDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onSubmit={(input) => void handleGenerate(input)}
        isSubmitting={isGenerating}
        defaultThemeId={
          currentTheme.kind === 'bundled'
            ? currentTheme.themeId
            : DEFAULT_THEME_ID
        }
      />
    </div>
  )
}
