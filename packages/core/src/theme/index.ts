/**
 * @akitaroh/marp-core/theme
 *
 * ブランドテーマの schema と読込ロジック。
 *
 * - ThemeData (Data Atom): schema 定義
 * - ThemeLoader (Logic Atom): CSS ファイル読込 + メタデータ抽出
 */

export type { ThemeData, ThemeSize, ThemeId } from './theme-schema'
export {
  ThemeDataValidationError,
  isValidThemeData,
  assertValidThemeData,
} from './theme-validator'
export type { ThemeDataValidationErrorKind } from './theme-validator'
export { loadTheme, ThemeLoaderError } from './theme-loader'
export type { ThemeLoadInput, ThemeLoaderErrorKind } from './theme-loader'
