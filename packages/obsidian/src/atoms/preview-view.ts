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
}

export class MarpPreviewView extends ItemView {
  private deps: PreviewViewDeps
  private iframeEl: HTMLIFrameElement | null = null
  private statusEl: HTMLElement | null = null
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

  private buildUI(): void {
    const root = this.contentEl
    root.empty()
    root.addClass('marp-maker-preview')
    this.statusEl = root.createDiv({
      cls: 'marp-maker-status',
      text: 'Marp ファイルを開いてください（frontmatter に marp: true）',
    })
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
