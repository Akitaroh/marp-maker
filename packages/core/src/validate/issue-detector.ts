/**
 * ZDD Atom: Atom-IssueDetector (Logic Adapter)
 * Marp Markdown を PNG 化し、Claude Vision API で issues を検出する。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-IssueDetector.md
 *
 * - 入力: DetectInput
 * - 出力: Issue[]
 * - 副作用: MarpRenderer 経由 PNG 化 + Claude API (vision) 呼出
 * - fail-soft: API/JSON エラー時は空配列、上位の視覚検証ループを止めない
 */

import Anthropic from '@anthropic-ai/sdk'

import { renderMarp, type RenderInput, type RenderOutput } from '../marp/marp-renderer.js'

// ===== Issue 型 (FixSuggester が import する SoT) =====

export type IssueType =
  | 'overflow'
  | 'overlap'
  | 'layout'
  | 'contrast'
  | 'readability'
  | 'other'

export type Severity = 'high' | 'medium' | 'low'

export interface Issue {
  page: number
  type: IssueType
  description: string
  severity: Severity
  bboxHint?: { x: number; y: number; w: number; h: number }
}

// ===== 入力型 =====

export interface DetectInput {
  markdown: string
  themePath: string
  pageRange?: [number, number]
  maxIssuesPerPage?: number
  severityThreshold?: Severity
}

// ===== オプション =====

export type RendererFn = (input: RenderInput) => Promise<RenderOutput>

export interface IssueDetectorOptions {
  client?: Anthropic
  renderer?: RendererFn
  model?: string
}

// ===== 内部定数 =====

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_ISSUES_PER_PAGE = 5
const CHUNK_SIZE = 20
const MAX_TOKENS = 4000

const VALID_ISSUE_TYPES: ReadonlySet<IssueType> = new Set([
  'overflow',
  'overlap',
  'layout',
  'contrast',
  'readability',
  'other',
])

const VALID_SEVERITIES: ReadonlySet<Severity> = new Set(['high', 'medium', 'low'])

// ===== プロンプト構築 =====

function buildSystemPrompt(maxIssuesPerPage: number): string {
  return `You are an expert reviewer of B2B whitepaper slides rendered from Marp.
Detect visual issues in the provided slide images and return them as JSON.

Issue types:
- overflow: text/element overflows the slide area
- overlap: elements visually collide
- layout: misaligned, uneven margins, or odd whitespace
- contrast: insufficient color contrast (text vs background)
- readability: font size, line length, or visual hierarchy problems
- other: any other issue worth attention

Severity:
- high: critical, must fix
- medium: noticeable, should fix
- low: minor, optional

Rules:
- Return ONLY a JSON array, no prose
- Each item: { "page": <1-indexed>, "type": <IssueType>, "description": <string>, "severity": <Severity> }
- Max ${maxIssuesPerPage} issues per page
- If no issues, return []
- Do NOT wrap in markdown code fence`
}

function buildUserPrompt(chunkStartPage: number): string {
  return `Review these slide images (starting from page ${chunkStartPage}, 1-indexed) and list visual issues as JSON.`
}

// ===== 内部ロジック =====

function extractTextContent(
  content: Anthropic.Messages.ContentBlock[]
): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

function parseIssues(responseText: string, fallbackPage: number): Issue[] {
  // JSON 配列を抽出 (前後にゴミがあっても [...] を見つける)
  const match = responseText.match(/\[[\s\S]*\]/)
  if (!match) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const issues: Issue[] = []
  for (const raw of parsed) {
    if (typeof raw !== 'object' || raw === null) continue
    const v = raw as Record<string, unknown>

    const page =
      typeof v.page === 'number' && Number.isInteger(v.page) && v.page > 0
        ? v.page
        : fallbackPage
    const type = VALID_ISSUE_TYPES.has(v.type as IssueType)
      ? (v.type as IssueType)
      : 'other'
    const description = typeof v.description === 'string' ? v.description : ''
    const severity = VALID_SEVERITIES.has(v.severity as Severity)
      ? (v.severity as Severity)
      : 'medium'

    if (description.length === 0) continue

    issues.push({ page, type, description, severity })
  }
  return issues
}

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 }

function filterBySeverity(issues: Issue[], threshold: Severity): Issue[] {
  const min = SEVERITY_RANK[threshold]
  return issues.filter((i) => SEVERITY_RANK[i.severity] >= min)
}

function chunkBuffers<T>(buffers: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < buffers.length; i += chunkSize) {
    chunks.push(buffers.slice(i, i + chunkSize))
  }
  return chunks
}

async function detectChunk(
  client: Anthropic,
  model: string,
  chunk: Buffer[],
  chunkStartPage: number,
  maxIssuesPerPage: number
): Promise<Issue[]> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(maxIssuesPerPage),
      messages: [
        {
          role: 'user',
          content: [
            ...chunk.map((buf) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/png' as const,
                data: buf.toString('base64'),
              },
            })),
            {
              type: 'text' as const,
              text: buildUserPrompt(chunkStartPage),
            },
          ],
        },
      ],
    })

    const text = extractTextContent(response.content)
    const issues = parseIssues(text, chunkStartPage)

    // maxIssuesPerPage 制限 (ページ単位で truncate)
    const grouped = new Map<number, Issue[]>()
    for (const issue of issues) {
      const list = grouped.get(issue.page) ?? []
      if (list.length < maxIssuesPerPage) {
        list.push(issue)
        grouped.set(issue.page, list)
      }
    }
    return Array.from(grouped.values()).flat()
  } catch {
    // chunk 失敗は無視 (fail-soft)
    return []
  }
}

// ===== 公開 API =====

/**
 * Marp Markdown を PNG にレンダして Claude Vision API で issues を検出する。
 *
 * fail-soft: PNG 化失敗 / API 失敗 / JSON パース失敗のいずれかが起きても throw せず空配列を返す。
 * 上位の視覚検証ループ (生成 → 検出 → 修正) を API 障害で完全停止させない設計。
 */
export async function detectIssues(
  input: DetectInput,
  options: IssueDetectorOptions = {}
): Promise<Issue[]> {
  const client = options.client ?? new Anthropic()
  const renderer = options.renderer ?? renderMarp
  const model = options.model ?? DEFAULT_MODEL
  const maxIssuesPerPage = input.maxIssuesPerPage ?? DEFAULT_MAX_ISSUES_PER_PAGE

  // PNG 化
  let pngBuffers: Buffer[]
  try {
    const renderInput: RenderInput =
      input.pageRange != null
        ? {
            markdown: input.markdown,
            themePath: input.themePath,
            format: 'png',
            pageRange: input.pageRange,
          }
        : {
            markdown: input.markdown,
            themePath: input.themePath,
            format: 'png',
          }
    const result = await renderer(renderInput)
    if (result.format !== 'png') return []
    pngBuffers = result.pngBuffers
  } catch {
    return [] // fail-soft
  }

  if (pngBuffers.length === 0) return []

  // 20 ページ単位 chunk
  const chunks = chunkBuffers(pngBuffers, CHUNK_SIZE)
  const baseStartPage = input.pageRange?.[0] ?? 1

  const allIssues: Issue[] = []
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]!
    const chunkStartPage = baseStartPage + ci * CHUNK_SIZE
    const chunkIssues = await detectChunk(
      client,
      model,
      chunk,
      chunkStartPage,
      maxIssuesPerPage
    )
    allIssues.push(...chunkIssues)
  }

  if (input.severityThreshold) {
    return filterBySeverity(allIssues, input.severityThreshold)
  }
  return allIssues
}
