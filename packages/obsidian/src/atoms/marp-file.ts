/**
 * Marp ファイル判定の純ロジック（Obsidian API 非依存・テスト可能）。
 *
 * frontmatter に `marp: true` を持つものだけを MarpMaker の対象とする。
 * preview-view（描画対象）と main の export ゲートで共用する（DRY）。
 */
export interface FrontmatterLike {
  marp?: unknown
}

/** frontmatter が `marp: true` を持つか */
export function hasMarpFrontmatter(fm: FrontmatterLike | undefined | null): boolean {
  return fm?.marp === true
}
