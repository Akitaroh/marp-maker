/**
 * Atom-ObsidianPreviewView — ItemView 継承の Marp プレビュー custom view。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianPreviewView.md
 *
 * active な marp `.md`（frontmatter marp: true）を marp-core で描画し、
 * iframe srcdoc に注入する。.md は素のまま（host の wikilink/検索/Sync を活かす）、
 * このペインは併走プレビュー（Bond-PreviewViewMarpCore）。
 */
import { ItemView, WorkspaceLeaf, TFile, Editor } from 'obsidian'
import type { RenderResult } from './marp-core-render'
import { hasMarpFrontmatter } from './marp-file'

export const VIEW_TYPE_MARP = 'marp-preview-view'

export interface PreviewViewDeps {
  // marp-core in-renderer 描画（marp-cli 不使用）
  renderMarp: (markdown: string) => RenderResult
  // プレビュー枠の書き出しボタン用（Main が exportActiveDeck を注入）。任意。
  onExport?: () => void | Promise<void>
  // テーマ選択ドロップダウン用（任意）。選ぶと deck の frontmatter theme: に書き込む。
  getThemeNames?: () => string[]
  getDefaultThemeName?: () => string
}

export class MarpPreviewView extends ItemView {
  private deps: PreviewViewDeps
  private iframeEl: HTMLIFrameElement | null = null
  private statusEl: HTMLElement | null = null
  private themeSelectEl: HTMLSelectElement | null = null
  private currentFile: TFile | null = null
  private debounceTimer: number | null = null

  constructor(leaf: WorkspaceLeaf, deps: PreviewViewDeps) {
    super(leaf)
    this.deps = deps
  }

  getViewType(): string {
    return VIEW_TYPE_MARP
  }
  getDisplayText(): string {
    return 'Marp Preview'
  }
  getIcon(): string {
    return 'presentation'
  }

  async onOpen(): Promise<void> {
    this.buildUI()
    // host イベントに乗る: ファイルを開いた / エディタ変更で再描画
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => this.onFileOpen(file)),
    )
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor: Editor) =>
        this.onEditorChange(editor),
      ),
    )
    this.onFileOpen(this.app.workspace.getActiveFile())
  }

  async onClose(): Promise<void> {
    if (this.debounceTimer != null) window.clearTimeout(this.debounceTimer)
  }

  /** 外部トリガー（テーマ設定変更等）で再描画 + ドロップダウン候補を更新 */
  refresh(): void {
    this.populateThemeSelect()
    if (this.currentFile) {
      this.syncThemeSelect()
      this.scheduleRenderFromFile()
    }
  }

  /** ドロップダウンの選択肢を組む（先頭は「既定にまかせる」、以降は各テーマ名） */
  private populateThemeSelect(): void {
    const sel = this.themeSelectEl
    if (!sel || !this.deps.getThemeNames) return
    sel.empty()
    const def = this.deps.getDefaultThemeName?.() ?? 'whitepaper-a4'
    const noneOpt = sel.createEl('option', { text: `（既定: ${def}）` })
    noneOpt.value = ''
    for (const name of this.deps.getThemeNames()) {
      const opt = sel.createEl('option', { text: name })
      opt.value = name
    }
  }

  /** 現在 deck の frontmatter theme: をドロップダウンに反映 */
  private syncThemeSelect(): void {
    const sel = this.themeSelectEl
    if (!sel || !this.currentFile) return
    const fm = this.app.metadataCache.getFileCache(this.currentFile)?.frontmatter
    const theme = typeof fm?.theme === 'string' ? fm.theme : ''
    sel.value = theme
    // 候補に無いテーマ名なら「既定」にフォールバック表示
    if (sel.value !== theme) sel.value = ''
  }

  /** ドロップダウン選択 → deck の frontmatter theme: を書き換える */
  private async onThemeSelected(): Promise<void> {
    const sel = this.themeSelectEl
    if (!sel || !this.currentFile) return
    const value = sel.value
    await this.app.fileManager.processFrontMatter(this.currentFile, (fm) => {
      if (value === '') delete fm.theme
      else fm.theme = value
    })
    // frontmatter 変更でファイルが更新される → 再描画
    this.scheduleRenderFromFile()
  }

  private buildUI(): void {
    const root = this.contentEl
    root.empty()
    root.addClass('marp-maker-preview')
    // ヘッダ: ステータス + 書き出しボタン（コマンドパレットだけだと見つけにくいため）
    const header = root.createDiv({ cls: 'marp-maker-header' })
    this.statusEl = header.createDiv({
      cls: 'marp-maker-status',
      text: 'Marp ファイルを開いてください（frontmatter に marp: true）',
    })
    // テーマ選択ドロップダウン（選ぶと deck の frontmatter theme: に書き込む）
    if (this.deps.getThemeNames) {
      this.themeSelectEl = header.createEl('select', {
        cls: 'marp-maker-theme-select dropdown',
      })
      this.themeSelectEl.setAttribute('aria-label', 'この deck のテーマ')
      this.populateThemeSelect()
      this.themeSelectEl.onchange = () => void this.onThemeSelected()
    }
    if (this.deps.onExport) {
      const exportBtn = header.createEl('button', {
        cls: 'marp-maker-export-btn',
        text: 'PDF/HTML 書き出し',
      })
      exportBtn.setAttribute('aria-label', 'この Marp deck を書き出す')
      exportBtn.onclick = () => void this.deps.onExport?.()
    }
    this.iframeEl = root.createEl('iframe', { cls: 'marp-maker-iframe' })
    // 静的スライドなので script 不要。Marp の CSS reset を Obsidian 本体から隔離
    this.iframeEl.setAttribute('sandbox', 'allow-same-origin')
  }

  /** frontmatter marp: true を持つ .md のみ対象 */
  private isMarpFile(file: TFile | null): file is TFile {
    if (!file || file.extension !== 'md') return false
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
    return hasMarpFrontmatter(fm)
  }

  private onFileOpen(file: TFile | null): void {
    if (this.isMarpFile(file)) {
      this.currentFile = file
      this.syncThemeSelect()
      this.scheduleRenderFromFile()
    }
  }

  private onEditorChange(editor: Editor): void {
    const file = this.app.workspace.getActiveFile()
    if (this.isMarpFile(file)) {
      this.currentFile = file
      // ライブ編集中は editor 内容で描画（cachedRead は最後の保存内容）
      this.scheduleRender(() => this.renderMarkdown(editor.getValue()))
    }
  }

  private scheduleRenderFromFile(): void {
    this.scheduleRender(async () => {
      if (!this.currentFile) return
      const md = await this.app.vault.cachedRead(this.currentFile)
      this.renderMarkdown(md)
    })
  }

  private scheduleRender(fn: () => void | Promise<void>): void {
    if (this.debounceTimer != null) window.clearTimeout(this.debounceTimer)
    this.debounceTimer = window.setTimeout(() => void fn(), 400)
  }

  private renderMarkdown(markdown: string): void {
    try {
      const { html, css } = this.deps.renderMarp(markdown)
      if (this.iframeEl) {
        // marp-core の css の後に、スライドを「枠付きカード」に見せる CSS を足す。
        // 白スライドが白背景に溶けないよう body をグレー + 各 svg slide に影/余白。
        const frameCss = [
          'html,body{margin:0;padding:0;}',
          'body{padding:16px;background:#4b4f52;}',
          'svg[data-marpit-svg]{display:block;width:100%;height:auto;margin:0 auto 16px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.4);}',
        ].join('\n')
        this.iframeEl.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}\n${frameCss}</style></head><body>${html}</body></html>`
      }
      this.setStatus(`📄 ${this.currentFile?.basename ?? ''}`)
    } catch (e) {
      this.setStatus('❌ marp-core 描画失敗: ' + String(e))
    }
  }

  private setStatus(text: string): void {
    this.statusEl?.setText(text)
  }
}
