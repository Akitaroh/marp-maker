/**
 * Atom-ObsidianSettings — MarpMaker の設定タブ（View Adapter, PluginSettingTab）。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianSettings.md
 *
 * カスタムテーマフォルダと既定テーマを選ぶ。選択（deck ごと）は frontmatter `theme:`
 * が marp 標準。ここは「カスタム CSS の導線」と「既定テーマ」を設定する。
 */
import { App, PluginSettingTab, Setting } from 'obsidian'
import type { Plugin } from 'obsidian'

export interface MarpMakerSettings {
  /** Vault 内のカスタムテーマ CSS フォルダ（空 = 無効） */
  themesFolder: string
  /** deck に `theme:` 指定が無いときの既定テーマ名 */
  defaultTheme: string
}

export const DEFAULT_SETTINGS: MarpMakerSettings = {
  themesFolder: '',
  defaultTheme: 'whitepaper-a4',
}

export interface SettingTabDeps {
  getSettings(): MarpMakerSettings
  /** 値の永続化のみ（軽量、再読込はしない） */
  updateSettings(patch: Partial<MarpMakerSettings>): Promise<void>
  /** テーマ再読込 + 開いているプレビュー再描画（タブを閉じた時に適用） */
  applyThemes(): Promise<void>
  /** ドロップダウン候補（組込 + バンドル + カスタム） */
  getThemeNames(): string[]
}

export class MarpMakerSettingTab extends PluginSettingTab {
  private deps: SettingTabDeps

  constructor(app: App, plugin: Plugin, deps: SettingTabDeps) {
    super(app, plugin)
    this.deps = deps
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    const s = this.deps.getSettings()

    new Setting(containerEl)
      .setName('カスタムテーマフォルダ')
      .setDesc(
        'Vault 内のフォルダパス。中の .css（先頭に /* @theme 名前 */ を付ける）を読み込み、deck の frontmatter で theme: 名前 と書くと使える。空で無効。変更はタブを閉じると反映（ドロップダウン候補はタブを開き直すと更新）。',
      )
      .addText((text) =>
        text
          .setPlaceholder('例: marp-themes')
          .setValue(s.themesFolder)
          .onChange((value) => {
            void this.deps.updateSettings({ themesFolder: value.trim() })
          }),
      )

    new Setting(containerEl)
      .setName('既定テーマ')
      .setDesc(
        'deck の frontmatter に theme: 指定が無いとき使うテーマ。deck 側で theme: を書けばそちらが優先される。',
      )
      .addDropdown((dd) => {
        for (const name of this.deps.getThemeNames()) dd.addOption(name, name)
        dd.setValue(s.defaultTheme)
        dd.onChange((value) => {
          void this.deps.updateSettings({ defaultTheme: value })
        })
      })
  }

  hide(): void {
    // タブを離れる時に再読込 + 再描画（per-keystroke のフォルダ読込を避ける）
    void this.deps.applyThemes()
  }
}
