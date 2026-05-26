/**
 * Atom-ObsidianMain — MarpMaker Obsidian Plugin entry。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianMain.md / Molecule-obsidian-plugin.md
 *
 * onload で設定読込 → テーマ（whitepaper-a4 + Vault カスタム）を組んだ marp-core 描画関数
 * と VaultIO を用意し、preview view / command / 設定タブを登録する薄い Adapter。
 * v2: AI 生成・検証は内蔵しない（agent/MCP 担当）。
 */
import { Plugin, WorkspaceLeaf, Notice, TFile } from 'obsidian'
import { MarpPreviewView, VIEW_TYPE_MARP } from './atoms/preview-view'
import { createRenderMarp, type RenderResult } from './atoms/marp-core-render'
import { registerCommands } from './atoms/command-registry'
import { createVaultIO, type VaultIO } from './atoms/vault-io'
import { exportDeck } from './atoms/pdf-exporter'
import { hasMarpFrontmatter } from './atoms/marp-file'
import { availableThemeNames, toThemeEntries } from './atoms/theme-registry'
import {
  MarpMakerSettingTab,
  DEFAULT_SETTINGS,
  type MarpMakerSettings,
} from './atoms/settings-tab'
import { WHITEPAPER_A4_CSS } from './themes/whitepaper-a4'
import { OYAKUDACHI_CSS } from './themes/oyakudachi'
import { WHITEPAPER_PRO_CSS } from './themes/whitepaper-pro'
import { MONOCHROME_CSS } from './themes/monochrome'
import './styles.css'

export default class MarpMakerPlugin extends Plugin {
  private settings: MarpMakerSettings = DEFAULT_SETTINGS
  private customThemeCss: string[] = []
  private vaultIO!: VaultIO
  // テーマ設定変更で差し替わる描画関数。view/export には安定ラッパー越しに渡す。
  private renderImpl: (markdown: string) => RenderResult = createRenderMarp()

  async onload(): Promise<void> {
    await this.loadSettings()
    this.vaultIO = createVaultIO(this.app.vault)
    await this.reloadThemes()

    // 安定ラッパー: 中で最新の renderImpl を参照（設定変更で view 再生成不要）
    const renderMarp = (md: string): RenderResult => this.renderImpl(md)

    this.registerView(
      VIEW_TYPE_MARP,
      (leaf: WorkspaceLeaf) =>
        new MarpPreviewView(leaf, {
          renderMarp,
          onExport: () => this.exportActiveDeck(),
          getThemeNames: () =>
            availableThemeNames(toThemeEntries(this.customThemeCss)),
          getDefaultThemeName: () => this.settings.defaultTheme,
        }),
    )

    this.addRibbonIcon('presentation', 'Marp プレビューを開く', () => {
      void this.activatePreview()
    })

    registerCommands(this, {
      onOpenPreview: () => this.activatePreview(),
      onExport: () => this.exportActiveDeck(),
    })

    this.addSettingTab(
      new MarpMakerSettingTab(this.app, this, {
        getSettings: () => this.settings,
        updateSettings: (patch) => this.updateSettings(patch),
        applyThemes: () => this.applyThemes(),
        getThemeNames: () =>
          availableThemeNames(toThemeEntries(this.customThemeCss)),
      }),
    )

    console.log('[marp-maker] loaded')
  }

  async onunload(): Promise<void> {
    console.log('[marp-maker] unloaded')
  }

  // --- 設定 ---

  private async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) ?? {}) }
  }

  private async updateSettings(patch: Partial<MarpMakerSettings>): Promise<void> {
    this.settings = { ...this.settings, ...patch }
    await this.saveData(this.settings)
  }

  // --- テーマ ---

  /** Vault カスタム CSS を読み、whitepaper-a4 と束ねて描画関数を組み直す */
  private async reloadThemes(): Promise<void> {
    this.customThemeCss = await this.vaultIO.readCssInFolder(
      this.settings.themesFolder,
    )
    this.renderImpl = createRenderMarp({
      themes: [WHITEPAPER_A4_CSS, OYAKUDACHI_CSS, WHITEPAPER_PRO_CSS, MONOCHROME_CSS, ...this.customThemeCss],
      defaultThemeName: this.settings.defaultTheme,
    })
  }

  /** テーマ再読込 + 開いているプレビューを再描画（設定タブを閉じた時） */
  private async applyThemes(): Promise<void> {
    await this.reloadThemes()
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MARP)) {
      const view = leaf.view
      if (view instanceof MarpPreviewView) view.refresh()
    }
  }

  // --- view / export ---

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
  private async exportActiveDeck(): Promise<void> {
    const file = this.app.workspace.getActiveFile()
    if (!this.isMarpFile(file)) {
      new Notice('Marp ファイル（frontmatter に marp: true）を開いてから実行してください')
      return
    }
    try {
      new Notice('Marp を書き出し中…')
      const md = await this.app.vault.cachedRead(file)
      const result = await exportDeck(md, file.path, {
        renderMarp: this.renderImpl,
        vaultIO: this.vaultIO,
      })
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
