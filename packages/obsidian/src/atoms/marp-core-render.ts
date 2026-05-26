/**
 * Atom: marp-core in-renderer 描画ラッパー（Adapter）。
 * 設計: Bond-PreviewViewMarpCore / Atom-ObsidianPreviewView
 *
 * marp-core を Obsidian の Electron renderer で実行する。Chrome 子プロセス不要
 *（marp-cli = Atom-MarpRenderer は preview では使わない）。
 * Atom-MarpBoard と同パターンを packages/obsidian に複製（N=2、既存 core 非改変）。
 */
import { Marp } from '@marp-team/marp-core'
import { applyMarpContainers } from './marp-containers'

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
    // html: true — お役立ち資料テーマのカード/2カラム等で HTML-in-markdown を使う。
    // deck は利用者自身が書く信頼入力 + プレビューは sandbox iframe（script 不可）なので許容。
    const marp = new Marp({ html: true })
    // `:::` コンテナ記法 → コンポーネント HTML 展開（Atom-MarpContainers）。
    // 失敗しても deck 描画は継続（`:::` は素通り）する graceful degradation。
    try {
      applyMarpContainers(marp.markdown)
    } catch {
      /* container 拡張に失敗しても描画継続 */
    }
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
