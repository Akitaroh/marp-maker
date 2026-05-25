/**
 * Atom-ObsidianThemeRegistry — テーマ名の解決・一覧化（純ロジック）。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianThemeRegistry.md
 *
 * marp テーマ CSS から `/* @theme name *​/` を抽出し、選択可能なテーマ名一覧
 *（組込 + バンドル whitepaper-a4 + Vault カスタム）を作る。Obsidian/marp 非依存でテスト可能。
 */
export interface ThemeEntry {
  name: string
  css: string
}

/** バンドル同梱テーマ名 */
export const BUNDLED_THEME_NAME = 'whitepaper-a4'

/** marp-core 組込テーマ名 */
export const BUILTIN_THEME_NAMES = ['default', 'gaia', 'uncover'] as const

/** CSS から `/* @theme name *​/` を抽出（無ければ null） */
export function parseThemeName(css: string): string | null {
  const m = css.match(/\/\*\s*@theme\s+([\w-]+)\s*\*\//)
  return m ? m[1] : null
}

/** css 文字列群を ThemeEntry に（@theme 名が取れたものだけ採用） */
export function toThemeEntries(cssList: string[]): ThemeEntry[] {
  const entries: ThemeEntry[] = []
  for (const css of cssList) {
    const name = parseThemeName(css)
    if (name) entries.push({ name, css })
  }
  return entries
}

/**
 * 選択可能なテーマ名一覧（重複除去）。
 * whitepaper-a4（バンドル）→ 組込（default/gaia/uncover）→ カスタムの順。
 */
export function availableThemeNames(customThemes: ThemeEntry[]): string[] {
  const names = [
    BUNDLED_THEME_NAME,
    ...BUILTIN_THEME_NAMES,
    ...customThemes.map((t) => t.name),
  ]
  return [...new Set(names)]
}
