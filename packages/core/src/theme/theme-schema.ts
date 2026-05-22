/**
 * ZDD Atom: Atom-ThemeData (Data)
 * MarpMaker のブランドテーマ schema 定義
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-ThemeData.md
 */

/**
 * Branded type for type safety.
 * テーマ識別子と一般文字列を型レベルで区別する。
 */
export type ThemeId = string & { readonly __brand: 'ThemeId' }

/**
 * テーマのサイズメタデータ。
 * Marp の `@size` ディレクティブと対応する。
 */
export interface ThemeSize {
  /** サイズ名 (例: "A4", "Letter", "Custom") */
  name: string
  /** 幅 (positive integer, pixels) */
  width: number
  /** 高さ (positive integer, pixels) */
  height: number
}

/**
 * MarpMaker のブランドテーマ。
 *
 * - 不変性の質: 読込時点で固定。読込後は ThemeData インスタンスとして不変。
 * - cross-field 制約:
 *   - cssContent 内の `@theme` メタデータ抽出名 === id
 *   - cssContent 内の `@size` メタデータ === size.name / size.width / size.height
 *
 * バリデーションは `assertValidThemeData` / `isValidThemeData` (theme-validator.ts) を使う。
 */
export interface ThemeData {
  /** テーマ識別子 (kebab-case 推奨) */
  id: ThemeId
  /** CSS ファイル全文 (`@theme` / `@size` メタデータコメントを含む必須) */
  cssContent: string
  /** サイズメタデータ */
  size: ThemeSize
}
