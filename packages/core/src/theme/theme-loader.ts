/**
 * ZDD Atom: Atom-ThemeLoader (Logic Adapter)
 * CSS テーマファイルを読み込み、メタデータを抽出して ThemeData インスタンスを生成。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-ThemeLoader.md
 *
 * - 入力: { themeId } (バンドル) or { themePath } (外部絶対パス)
 * - 出力: ThemeData (Atom-ThemeData)
 * - 副作用: ファイルシステム読込
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ThemeData, ThemeId } from './theme-schema.js'
import {
  ThemeDataValidationError,
  assertValidThemeData,
} from './theme-validator.js'

// ===== 内部定数 =====

const THEME_META_RE = /\/\*\s*@theme\s+([\w-]+)\s*\*\//
const SIZE_META_RE = /\/\*\s*@size\s+([\w-]+)\s+(\d+)px\s+(\d+)px\s*\*\//

// バンドル時テーマのディレクトリ (packages/core/themes/)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_THEMES_DIR = path.resolve(__dirname, '../../themes')

// ===== 入力型 (discriminated union) =====

export type ThemeLoadInput =
  | { themeId: string }
  | { themePath: string }

// ===== エラー型 =====

export type ThemeLoaderErrorKind =
  | 'file-not-found'
  | 'read-failed'
  | 'metadata-missing'
  | 'validation-failed'

interface ThemeLoaderErrorOpts {
  kind: ThemeLoaderErrorKind
  path?: string
  cause?: unknown
  message?: string
}

export class ThemeLoaderError extends Error {
  readonly kind: ThemeLoaderErrorKind
  readonly path?: string
  override readonly cause?: unknown

  constructor(opts: ThemeLoaderErrorOpts) {
    super(opts.message ?? `[${opts.kind}] ${opts.path ?? ''}`)
    this.name = 'ThemeLoaderError'
    this.kind = opts.kind
    this.path = opts.path
    this.cause = opts.cause
  }
}

// ===== 公開 API =====

/**
 * テーマ ID または絶対パスから ThemeData を生成する。
 *
 * バンドル時テーマ: `packages/core/themes/<themeId>.css` を読込
 * 外部テーマ: 渡された絶対パスを直接読込
 *
 * メタデータ抽出 + バリデーションに失敗した場合は ThemeLoaderError を throw。
 * バリデーション側の ThemeDataValidationError は `kind: 'validation-failed'` の cause として包む。
 */
export async function loadTheme(input: ThemeLoadInput): Promise<ThemeData> {
  const resolvedPath = resolveThemePath(input)

  const cssContent = await readCss(resolvedPath)
  const themeData = parseThemeData(cssContent, resolvedPath)

  try {
    assertValidThemeData(themeData)
  } catch (e) {
    if (e instanceof ThemeDataValidationError) {
      throw new ThemeLoaderError({
        kind: 'validation-failed',
        path: resolvedPath,
        cause: e,
        message: `Validation failed: ${e.message}`,
      })
    }
    throw e
  }

  return themeData
}

// ===== 内部関数 =====

function resolveThemePath(input: ThemeLoadInput): string {
  if ('themeId' in input) {
    return path.join(BUNDLED_THEMES_DIR, `${input.themeId}.css`)
  }
  return input.themePath
}

async function readCss(resolvedPath: string): Promise<string> {
  try {
    return await fs.readFile(resolvedPath, 'utf-8')
  } catch (e) {
    const error = e as NodeJS.ErrnoException
    if (error.code === 'ENOENT') {
      throw new ThemeLoaderError({
        kind: 'file-not-found',
        path: resolvedPath,
        cause: e,
      })
    }
    throw new ThemeLoaderError({
      kind: 'read-failed',
      path: resolvedPath,
      cause: e,
    })
  }
}

function parseThemeData(cssContent: string, resolvedPath: string): ThemeData {
  const themeMatch = cssContent.match(THEME_META_RE)
  const sizeMatch = cssContent.match(SIZE_META_RE)
  if (!themeMatch || !sizeMatch) {
    throw new ThemeLoaderError({
      kind: 'metadata-missing',
      path: resolvedPath,
      message: `Required metadata missing (@theme: ${!!themeMatch}, @size: ${!!sizeMatch})`,
    })
  }

  return {
    id: themeMatch[1] as ThemeId,
    cssContent,
    size: {
      name: sizeMatch[1]!,
      width: parseInt(sizeMatch[2]!, 10),
      height: parseInt(sizeMatch[3]!, 10),
    },
  }
}
