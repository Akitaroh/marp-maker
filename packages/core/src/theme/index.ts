/**
 * @akitaroh/marp-core/theme
 *
 * ブランドテーマの schema と読込ロジック。
 *
 * - ThemeData (Data Atom): schema 定義
 * - ThemeLoader (Logic Atom): CSS ファイル読込 + メタデータ抽出
 */

export type { ThemeData, ThemeSize, ThemeId } from './theme-schema.js'
export {
  ThemeDataValidationError,
  isValidThemeData,
  assertValidThemeData,
} from './theme-validator.js'
export type { ThemeDataValidationErrorKind } from './theme-validator.js'
export { loadTheme, ThemeLoaderError } from './theme-loader.js'
export type { ThemeLoadInput, ThemeLoaderErrorKind } from './theme-loader.js'
