/**
 * Atom-ObsidianMain — MarpMaker Obsidian Plugin entry。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianMain.md / Molecule-obsidian-plugin.md
 *
 * onload で marp-core 描画関数（whitepaper-a4 既定）と VaultIO を組み、
 * preview view と command（Open Preview / Export）を登録する薄い Adapter。
 * v2: AI 生成・検証は内蔵しない（agent/MCP 担当）。
 */
import { Plugin, WorkspaceLeaf, Notice, TFile } from 'obsidian'
import { MarpPreviewView, VIEW_TYPE_MARP } from './atoms/preview-view'
import { createRenderMarp } from './atoms/marp-core-render'
import { registerCommands } from './atoms/command-registry'
import { createVaultIO } from './atoms/vault-io'
import { exportDeck } from './atoms/pdf-exporter'
import { hasMarpFrontmatter } from './atoms/marp-file'
import { WHITEPAPER_A4_CSS } from './themes/whitepaper-a4'
import './styles.css'

export default class MarpMakerPlugin extends Plugin {
  async onload(): Promise<void> {
    // whitepaper-a4 を既定テーマに（deck の theme: 指定があればそちらが優先）
    const renderMarp = createRenderMarp(WHITEPAPER_A4_CSS)
    const vaultIO = createVaultIO(this.app.vault)

    this.registerView(
      VIEW_TYPE_MARP,
      (leaf: WorkspaceLeaf) => new MarpPreviewView(leaf, { renderMarp }),
    )

    this.addRibbonIcon('presentation', 'Marp プレビューを開く', () => {
      void this.activatePreview()
    })

    registerCommands(this, {
      onOpenPreview: () => this.activatePreview(),
      onExport: () => this.exportActiveDeck(renderMarp, vaultIO),
    })

    console.log('[marp-maker] loaded')
  }

  async onunload(): Promise<void> {
    console.log('[marp-maker] unloaded')
  }

  /** 右サイドに Marp プレビュー view を開く（既存があれば reveal） */
  private async activatePreview(): Promise<void> {
    const { workspace } = this.app
    let leaf: WorkspaceLeaf | null =
      workspace.getLeavesOfType(VIEW_TYPE_MARP)[0] ?? null
    if (!leaf) {
      leaf = workspace.getRightLeaf(false)
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE_MARP, active: true })
    }
    if (leaf) workspace.revealLeaf(leaf)
  }

  /** アクティブな Marp deck を書き出す（PDF を試み、ダメなら HTML） */
  private async exportActiveDeck(
    renderMarp: ReturnType<typeof createRenderMarp>,
    vaultIO: ReturnType<typeof createVaultIO>,
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile()
    if (!this.isMarpFile(file)) {
      new Notice('Marp ファイル（frontmatter に marp: true）を開いてから実行してください')
      return
    }
    try {
      new Notice('Marp を書き出し中…')
      const md = await this.app.vault.cachedRead(file)
      const result = await exportDeck(md, file.path, { renderMarp, vaultIO })
      new Notice(`✅ ${result.kind.toUpperCase()} を書き出しました: ${result.path}`)
    } catch (e) {
      new Notice('❌ エクスポート失敗: ' + String(e))
    }
  }

  private isMarpFile(file: TFile | null): file is TFile {
    if (!file || file.extension !== 'md') return false
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
    return hasMarpFrontmatter(fm)
  }
}
