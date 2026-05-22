/**
 * ZDD Atom: Atom-ThemeData (Data) のバリデーション関数
 * 不変条件 / cross-field 制約の検証を担当。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-ThemeData.md
 */

import type { ThemeData, ThemeSize } from './theme-schema.js'

// ===== 内部定数 =====

const KEBAB_CASE_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/
const THEME_META_RE = /\/\*\s*@theme\s+([\w-]+)\s*\*\//
const SIZE_META_RE = /\/\*\s*@size\s+([\w-]+)\s+(\d+)px\s+(\d+)px\s*\*\//

// ===== エラー型 =====

export type ThemeDataValidationErrorKind =
  | 'invalid-id'
  | 'invalid-css'
  | 'metadata-mismatch'
  | 'invalid-size'

interface ThemeDataValidationErrorOpts {
  kind: ThemeDataValidationErrorKind
  field: string
  actual?: unknown
  expected?: string
  message?: string
}

/**
 * ThemeData のバリデーション失敗時に throw されるエラー。
 *
 * - kind: 失敗の種類
 * - field: 違反フィールドのパス (例: "id", "size.width", "cssContent.@theme")
 * - actual: 実際の値 (検査時)
 * - expected: 期待する値の説明
 */
export class ThemeDataValidationError extends Error {
  readonly kind: ThemeDataValidationErrorKind
  readonly field: string
  readonly actual?: unknown
  readonly expected?: string

  constructor(opts: ThemeDataValidationErrorOpts) {
    const message =
      opts.message ??
      `[${opts.kind}] ${opts.field}` +
        (opts.expected ? ` (expected: ${opts.expected})` : '')
    super(message)
    this.name = 'ThemeDataValidationError'
    this.kind = opts.kind
    this.field = opts.field
    this.actual = opts.actual
    this.expected = opts.expected
  }
}

// ===== 内部判定関数 =====

function isValidId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && KEBAB_CASE_RE.test(value)
  )
}

function isValidSize(value: unknown): value is ThemeSize {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.name === 'string' &&
    v.name.length > 0 &&
    typeof v.width === 'number' &&
    Number.isInteger(v.width) &&
    v.width > 0 &&
    typeof v.height === 'number' &&
    Number.isInteger(v.height) &&
    v.height > 0
  )
}

// ===== 公開 API =====

/**
 * Type guard: ThemeData として valid か判定する (throw しない)。
 */
export function isValidThemeData(value: unknown): value is ThemeData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  if (!isValidId(v.id)) return false
  if (typeof v.cssContent !== 'string' || v.cssContent.length === 0)
    return false
  if (!isValidSize(v.size)) return false

  // cross-field validation
  const themeMatch = v.cssContent.match(THEME_META_RE)
  if (!themeMatch || themeMatch[1] !== v.id) return false

  const sizeMatch = v.cssContent.match(SIZE_META_RE)
  if (!sizeMatch) return false

  const size = v.size as ThemeSize
  if (
    sizeMatch[1] !== size.name ||
    parseInt(sizeMatch[2]!, 10) !== size.width ||
    parseInt(sizeMatch[3]!, 10) !== size.height
  )
    return false

  return true
}

/**
 * Assertion: ThemeData として valid であることを確認、不正なら ThemeDataValidationError を throw する。
 */
export function assertValidThemeData(
  value: unknown
): asserts value is ThemeData {
  if (typeof value !== 'object' || value === null) {
    throw new ThemeDataValidationError({
      kind: 'invalid-id',
      field: 'root',
      actual: value,
      expected: 'object',
    })
  }
  const v = value as Record<string, unknown>

  if (!isValidId(v.id)) {
    throw new ThemeDataValidationError({
      kind: 'invalid-id',
      field: 'id',
      actual: v.id,
      expected: 'non-empty kebab-case string',
    })
  }
  if (typeof v.cssContent !== 'string' || v.cssContent.length === 0) {
    throw new ThemeDataValidationError({
      kind: 'invalid-css',
      field: 'cssContent',
      actual: v.cssContent,
      expected: 'non-empty string',
    })
  }
  if (!isValidSize(v.size)) {
    throw new ThemeDataValidationError({
      kind: 'invalid-size',
      field: 'size',
      actual: v.size,
      expected: 'ThemeSize with name (non-empty) and positive integer width/height',
    })
  }

  // cross-field
  const themeMatch = v.cssContent.match(THEME_META_RE)
  if (!themeMatch) {
    throw new ThemeDataValidationError({
      kind: 'invalid-css',
      field: 'cssContent.@theme',
      expected: '@theme metadata comment present',
    })
  }
  if (themeMatch[1] !== v.id) {
    throw new ThemeDataValidationError({
      kind: 'metadata-mismatch',
      field: 'cssContent.@theme',
      actual: themeMatch[1],
      expected: String(v.id),
    })
  }

  const sizeMatch = v.cssContent.match(SIZE_META_RE)
  if (!sizeMatch) {
    throw new ThemeDataValidationError({
      kind: 'invalid-css',
      field: 'cssContent.@size',
      expected: '@size metadata comment present',
    })
  }
  const size = v.size as ThemeSize
  if (sizeMatch[1] !== size.name) {
    throw new ThemeDataValidationError({
      kind: 'metadata-mismatch',
      field: 'cssContent.@size.name',
      actual: sizeMatch[1],
      expected: size.name,
    })
  }
  if (parseInt(sizeMatch[2]!, 10) !== size.width) {
    throw new ThemeDataValidationError({
      kind: 'metadata-mismatch',
      field: 'cssContent.@size.width',
      actual: sizeMatch[2],
      expected: String(size.width),
    })
  }
  if (parseInt(sizeMatch[3]!, 10) !== size.height) {
    throw new ThemeDataValidationError({
      kind: 'metadata-mismatch',
      field: 'cssContent.@size.height',
      actual: sizeMatch[3],
      expected: String(size.height),
    })
  }
}
