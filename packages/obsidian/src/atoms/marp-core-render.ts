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

/**
 * marp-core 描画関数を作る。themeCss を渡すとブランド CSS（whitepaper-a4 等）を
 * themeSet に登録し、**既定テーマ**にする。
 *
 * テーマ解決順は marp（marpit）の仕様で「markdown の `theme:` ディレクティブ >
 * themeSet.default > 組込デフォルト」。よって whitepaper-a4 を default にしても、
 * deck 側で `theme: 別テーマ` を明示すればそちらが優先される（上書き可能）。
 * これで MarpMaker で開いた deck は既定で A4 ブランド見た目になる（差別化）。
 */
export function createRenderMarp(
  themeCss?: string,
): (markdown: string) => RenderResult {
  return (markdown: string): RenderResult => {
    const marp = new Marp()
    if (themeCss) {
      try {
        const theme = marp.themeSet.add(themeCss)
        // 既定テーマに（deck の theme: 指定があればそちらが優先される）
        marp.themeSet.default = theme
      } catch {
        /* 不正な theme CSS は無視してデフォルトで描画 */
      }
    }
    const { html, css } = marp.render(markdown)
    return { html, css }
  }
}
