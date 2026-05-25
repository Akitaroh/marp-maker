/**
 * Atom: marp-core in-renderer 描画ラッパー（Adapter）。
 * 設計: Bond-PreviewViewMarpCore / Atom-ObsidianPreviewView
 *
 * marp-core を Obsidian の Electron renderer で実行する。Chrome 子プロセス不要
 *（marp-cli = Atom-MarpRenderer は preview では使わない）。
 * Atom-MarpBoard と同パターンを packages/obsidian に複製（N=2、既存 core 非改変）。
 */
import { Marp } from '@marp-team/marp-core'

export interface RenderResult {
  html: string
  css: string
}

export interface RenderMarpOptions {
  /** 追加登録する theme CSS（バンドル whitepaper-a4 + Vault カスタム）。 */
  themes?: string[]
  /** 既定テーマ名（deck の `theme:` 指定があればそちらが優先）。 */
  defaultThemeName?: string
}

/**
 * marp-core 描画関数を作る。`themes` の CSS を themeSet に登録し、`defaultThemeName`
 * を既定テーマにする（組込 default/gaia/uncover も名前で指定可）。
 *
 * テーマ解決順は marp（marpit）の仕様で「markdown の `theme:` ディレクティブ >
 * themeSet.default > 組込デフォルト」。よって既定テーマを設定しても、deck 側で
 * `theme: 別テーマ` を明示すればそちらが優先される（＝選択可能）。
 */
export function createRenderMarp(
  opts?: RenderMarpOptions,
): (markdown: string) => RenderResult {
  const themes = opts?.themes ?? []
  const defaultThemeName = opts?.defaultThemeName
  return (markdown: string): RenderResult => {
    const marp = new Marp()
    for (const css of themes) {
      try {
        marp.themeSet.add(css)
      } catch {
        /* 不正な theme CSS は無視（他テーマ + 組込で描画継続） */
      }
    }
    if (defaultThemeName) {
      const theme = marp.themeSet.get(defaultThemeName)
      if (theme) marp.themeSet.default = theme
    }
    const { html, css } = marp.render(markdown)
    return { html, css }
  }
}
