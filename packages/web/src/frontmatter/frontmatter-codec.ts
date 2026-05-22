/**
 * Marp markdown の frontmatter ブロック parse / serialize utility。
 *
 * Atom-FrontmatterPanel から App.tsx が呼ぶ helper（Atom 化しない、< 200 行）。
 * 本パネル対象外フィールド (marp / theme / その他) は touch しない「surgical edit」方式。
 *
 * 設計 doc 参照: 50_Mission/zddmission/MarpMaker/Atom-FrontmatterPanel.md
 */

// ===== Types =====

export const SIZE_PRESETS = ['A4', '16-9', '4-3', 'Letter'] as const
export type SizePreset = (typeof SIZE_PRESETS)[number]

export interface FrontmatterValues {
  size?: SizePreset
  title?: string
  author?: string
  description?: string
  header?: string
  footer?: string
  paginate?: boolean
}

/**
 * 本パネルが管理するフィールド一覧（追加・更新・削除の対象）。
 * これ以外のフィールド（marp / theme / その他）は触らない。
 */
const HANDLED_FIELDS = [
  'size',
  'title',
  'author',
  'description',
  'header',
  'footer',
  'paginate',
] as const

type HandledField = (typeof HANDLED_FIELDS)[number]

// ===== Parsing =====

/**
 * markdown 先頭の frontmatter ブロックを検出し、本パネルが扱うフィールドの値を抽出。
 * frontmatter が無い場合は空オブジェクトを返す。
 */
export function extractFrontmatterValues(markdown: string): FrontmatterValues {
  const fm = parseFrontmatterBlock(markdown)
  if (!fm) return {}

  const result: FrontmatterValues = {}
  for (const line of fm.lines) {
    const kv = parseKeyValue(line)
    if (!kv) continue
    applyKeyValueToResult(result, kv.key, kv.value)
  }
  return result
}

/**
 * markdown の frontmatter ブロックに本パネルの values を反映。
 *
 * - 既存フィールドは値置換（同じ行を書き換え、順序維持）
 * - 新規フィールドは frontmatter 末尾に追加
 * - values で undefined 指定された既存フィールドは削除
 * - 本パネル対象外フィールド (marp / theme 等) は touch しない
 * - frontmatter ブロックが無い場合は markdown 先頭に新規挿入
 */
export function applyFrontmatterValues(
  markdown: string,
  values: FrontmatterValues
): string {
  const fm = parseFrontmatterBlock(markdown)

  if (!fm) {
    // frontmatter 無し → 新規作成して先頭に挿入
    const newLines = serializeNewFrontmatter(values)
    if (newLines.length === 0) return markdown
    return `---\n${newLines.join('\n')}\n---\n\n${markdown}`
  }

  // 既存 frontmatter を surgical edit
  const newLines = mergeLines(fm.lines, values)
  const head = `---\n${newLines.join('\n')}\n---`
  return head + markdown.slice(fm.endIndex)
}

// ===== Internal: frontmatter ブロック検出 =====

interface FrontmatterBlock {
  lines: string[]   // 開始 --- と終端 --- を除く中身行
  startIndex: number  // markdown 内のブロック開始 index（先頭の --- 含む）
  endIndex: number    // markdown 内のブロック終端 index（終端の --- の後の改行を含む）
}

function parseFrontmatterBlock(markdown: string): FrontmatterBlock | null {
  // 先頭が "---\n" or "---\r\n" でない → frontmatter 無し
  if (!/^---\r?\n/.test(markdown)) return null

  const startMatch = markdown.match(/^---\r?\n/)
  if (!startMatch) return null
  const startIndex = 0
  const contentStart = startMatch[0].length

  // 終端の "---" 行を探す（行頭で --- かつ行末まで --- のみ）
  const rest = markdown.slice(contentStart)
  const endMatch = rest.match(/^---\s*(\r?\n|$)/m)
  if (!endMatch) return null
  const endRelIndex = rest.indexOf(endMatch[0])
  // endMatch を行頭から見つけるため、検索範囲を newline 後に限定
  // 上の match は文頭優先なので、別アプローチで:
  const lines: string[] = []
  let cursor = 0
  let foundEnd = false
  let endLineLength = 0
  while (cursor < rest.length) {
    const nlIdx = rest.indexOf('\n', cursor)
    const line = nlIdx === -1 ? rest.slice(cursor) : rest.slice(cursor, nlIdx)
    const trimmedLine = line.replace(/\r$/, '')
    if (trimmedLine === '---') {
      foundEnd = true
      endLineLength = nlIdx === -1 ? line.length : nlIdx - cursor + 1
      cursor = nlIdx === -1 ? rest.length : nlIdx + 1
      break
    }
    lines.push(trimmedLine)
    if (nlIdx === -1) {
      cursor = rest.length
      break
    }
    cursor = nlIdx + 1
  }

  if (!foundEnd) return null
  // 検出失敗対策: endRelIndex の値を使うことで lint 警告を回避
  void endRelIndex

  const endIndex = contentStart + cursor
  return { lines, startIndex, endIndex }
}

// ===== Internal: 行パース =====

interface KeyValue {
  key: string
  value: string | boolean
}

function parseKeyValue(line: string): KeyValue | null {
  const trimmed = line.trim()
  if (trimmed === '') return null
  const m = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/)
  if (!m) return null
  const key = m[1]!
  const rawValue = m[2]!
  return { key, value: parseValue(rawValue) }
}

function parseValue(raw: string): string | boolean {
  const t = raw.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  // 引用符の剥がし
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
    return t.slice(1, -1).replace(/''/g, "'")
  }
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return t
}

function applyKeyValueToResult(
  result: FrontmatterValues,
  key: string,
  value: string | boolean
): void {
  if (!(HANDLED_FIELDS as readonly string[]).includes(key)) return

  switch (key as HandledField) {
    case 'size':
      if (typeof value === 'string' && (SIZE_PRESETS as readonly string[]).includes(value)) {
        result.size = value as SizePreset
      }
      break
    case 'paginate':
      if (typeof value === 'boolean') result.paginate = value
      break
    case 'title':
    case 'author':
    case 'description':
    case 'header':
    case 'footer':
      if (typeof value === 'string') {
        // TypeScript: key は 5 つの文字列 literal union、result[key] は string | undefined
        result[key as 'title' | 'author' | 'description' | 'header' | 'footer'] = value
      }
      break
  }
}

// ===== Internal: serialize =====

function formatValue(value: string | boolean): string {
  if (typeof value === 'boolean') return String(value)
  if (needsQuoting(value)) return quoteValue(value)
  return value
}

function needsQuoting(value: string): boolean {
  if (value === '') return true
  // YAML 仕様で特殊扱いされる文字 + Marp 用途で安全側に倒す
  if (/[:#\[\]{}>|!&%@`*?"']/.test(value)) return true
  if (/^\s|\s$/.test(value)) return true  // 前後の空白
  if (/^(true|false|null|yes|no)$/i.test(value)) return true  // boolean っぽい
  return false
}

function quoteValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function serializeLine(key: HandledField, value: string | boolean): string {
  return `${key}: ${formatValue(value)}`
}

function serializeNewFrontmatter(values: FrontmatterValues): string[] {
  const lines: string[] = []
  for (const field of HANDLED_FIELDS) {
    const v = values[field]
    if (v === undefined) continue
    lines.push(serializeLine(field, v))
  }
  return lines
}

/**
 * 既存 frontmatter の行に values を適用。
 *
 * 区別する 3 状態:
 * - field が values に **無い**（`field in values === false`）→ 既存行をそのまま保持
 * - field が values に **あり**で値が undefined → 既存行を削除
 * - field が values に **あり**で値が undefined 以外 → 既存行を置換 / 新規追加
 *
 * これにより panel は「変更したいフィールドのみを渡す」or 「全 state を渡し、空欄=空文字、削除=undefined」
 * のどちらの呼び方でも意図通りに動く。
 */
function mergeLines(existingLines: string[], values: FrontmatterValues): string[] {
  const seen = new Set<HandledField>()
  const merged: string[] = []

  for (const line of existingLines) {
    const kv = parseKeyValue(line)
    if (!kv) {
      // 空行 / コメント / 不正行はそのまま保持
      merged.push(line)
      continue
    }
    if (!(HANDLED_FIELDS as readonly string[]).includes(kv.key)) {
      // 本パネル対象外 → そのまま保持
      merged.push(line)
      continue
    }
    const field = kv.key as HandledField
    seen.add(field)
    if (!(field in values)) {
      // values に存在しない → 既存値を保持
      merged.push(line)
      continue
    }
    const newValue = values[field]
    if (newValue === undefined) {
      // 明示的 undefined → 削除
      continue
    }
    merged.push(serializeLine(field, newValue))
  }

  // 新規追加（既存に無いフィールドで values 提供されたもの）
  for (const field of HANDLED_FIELDS) {
    if (seen.has(field)) continue
    if (!(field in values)) continue
    const v = values[field]
    if (v === undefined) continue
    merged.push(serializeLine(field, v))
  }

  return merged
}
