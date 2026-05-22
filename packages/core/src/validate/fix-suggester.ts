/**
 * ZDD Atom: Atom-FixSuggester (Logic Adapter)
 * 検出された issues と元 Markdown から、Claude API で修正済み Markdown を生成する。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-FixSuggester.md
 *
 * - 入力: SuggestInput (issues + markdown + themePath + fixStrategy?)
 * - 出力: SuggestedMarp (markdown + appliedFixes + unsolved + tokensUsed)
 * - 副作用: Claude API (text mode) 呼出
 * - Issue 型は Atom-IssueDetector から import
 */

import Anthropic from '@anthropic-ai/sdk'

import type { Issue, Severity } from './issue-detector'

// ===== 入力型 =====

export interface SuggestInput {
  issues: Issue[]
  markdown: string
  themePath: string
  fixStrategy?: 'minimal' | 'aggressive'
}

// ===== 出力型 =====

export interface SuggestedMarp {
  markdown: string
  appliedFixes: number
  unsolved: Issue[]
  tokensUsed: { input: number; output: number }
}

// ===== エラー型 =====

export type SuggesterErrorKind =
  | 'api-error'
  | 'rate-limit'
  | 'invalid-output'
  | 'timeout'
  | 'auth-error'

interface SuggesterErrorOpts {
  kind: SuggesterErrorKind
  retryable: boolean
  cause?: unknown
  message?: string
}

export class SuggesterError extends Error {
  readonly kind: SuggesterErrorKind
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(opts: SuggesterErrorOpts) {
    super(opts.message ?? `[${opts.kind}]${opts.retryable ? ' (retryable)' : ''}`)
    this.name = 'SuggesterError'
    this.kind = opts.kind
    this.retryable = opts.retryable
    this.cause = opts.cause
  }
}

// ===== オプション =====

export interface SuggesterOptions {
  client?: Anthropic
  model?: string
  maxAttempts?: number
  maxTokens?: number
}

// ===== 内部定数 =====

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_MAX_TOKENS = 16000  // 元 Markdown 全体を返すため大きめ
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 8000

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 }

// ===== 内部ロジック =====

function sortIssues(issues: Issue[]): Issue[] {
  // severity 高 → 低、同 severity 内は page 順
  return [...issues].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (sevDiff !== 0) return sevDiff
    return a.page - b.page
  })
}

function extractFrontmatter(markdown: string): string {
  // 先頭 --- から次の --- までを frontmatter として抽出 (改行込み)
  const match = markdown.match(/^---\n[\s\S]*?\n---\n/)
  if (!match) {
    throw new SuggesterError({
      kind: 'invalid-output',
      retryable: false,
      message: 'Original markdown has no valid frontmatter',
    })
  }
  return match[0]
}

function countPageBreaks(markdown: string): number {
  const matches = markdown.match(/^---\s*$/gm)
  if (!matches) return 0
  // frontmatter の閉じ --- を 1 つ引く
  return Math.max(matches.length - 1, 0)
}

function buildSystemPrompt(strategy: 'minimal' | 'aggressive'): string {
  return `You are an expert editor of Marp Markdown whitepapers.
Given an original Markdown and a list of detected visual issues, output a CORRECTED Markdown that resolves the issues.

STRICT RULES:
- Output the COMPLETE corrected Markdown only (no prose, no JSON wrapping)
- PRESERVE the original frontmatter EXACTLY (do not change marp/theme/size/paginate)
- PRESERVE all page breaks (---) - do not remove or merge chapters
- Strategy: ${strategy === 'minimal' ? 'minimal — fix HIGH severity only, minimize layout changes' : 'aggressive — fix HIGH/MEDIUM/LOW issues, layout adjustments allowed'}
- Do NOT wrap in markdown code fence
- Do NOT add explanations`
}

function formatIssuesForPrompt(issues: Issue[]): string {
  return issues
    .map(
      (issue, i) =>
        `${i + 1}. [page ${issue.page}, ${issue.severity}, ${issue.type}] ${issue.description}`
    )
    .join('\n')
}

function buildUserPrompt(
  markdown: string,
  issues: Issue[],
  strategy: 'minimal' | 'aggressive'
): string {
  return `Detected issues (sorted by severity, fix in this order):

${formatIssuesForPrompt(issues)}

Original Markdown:

${markdown}

Output the corrected complete Markdown (preserve frontmatter and page breaks).`
}

function extractTextContent(
  content: Anthropic.Messages.ContentBlock[]
): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

function validateStructurePreserved(
  fixed: string,
  original: string
): void {
  const origFrontmatter = extractFrontmatter(original)
  if (!fixed.startsWith(origFrontmatter)) {
    throw new SuggesterError({
      kind: 'invalid-output',
      retryable: false,
      message: 'Frontmatter was modified or missing in the corrected markdown',
    })
  }
  const origPages = countPageBreaks(original)
  const fixedPages = countPageBreaks(fixed)
  if (fixedPages < origPages) {
    throw new SuggesterError({
      kind: 'invalid-output',
      retryable: false,
      message: `Page breaks decreased: ${origPages} → ${fixedPages}`,
    })
  }
}

function classifyError(e: unknown): SuggesterError {
  if (e instanceof SuggesterError) return e
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401 || e.status === 403) {
      return new SuggesterError({ kind: 'auth-error', retryable: false, cause: e })
    }
    if (e.status === 429) {
      return new SuggesterError({ kind: 'rate-limit', retryable: true, cause: e })
    }
    if (e.status != null && e.status >= 500) {
      return new SuggesterError({ kind: 'api-error', retryable: true, cause: e })
    }
    return new SuggesterError({ kind: 'api-error', retryable: false, cause: e })
  }
  const err = e as { name?: string; code?: string }
  if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
    return new SuggesterError({ kind: 'timeout', retryable: true, cause: e })
  }
  return new SuggesterError({
    kind: 'api-error',
    retryable: false,
    cause: e,
    message: (e as Error)?.message ?? 'Unknown error',
  })
}

function calcBackoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ===== 公開 API =====

/**
 * 検出された issues を元に修正済み Marp Markdown を生成する。
 *
 * - 空 issues: 元 Markdown をそのまま返す (appliedFixes: 0)
 * - 修正後の frontmatter / ページ区切り構造を検証 (invalid-output で throw)
 * - リトライポリシー: rate-limit / 5xx / timeout でリトライ、最大 maxAttempts 回
 *
 * MVP では unsolved は常に空配列 (全 issues を試行と仮定)。
 * Phase 2 で構造化出力 (tools API) を導入し、unsolved を AI に明示させる予定。
 */
export async function suggestFix(
  input: SuggestInput,
  options: SuggesterOptions = {}
): Promise<SuggestedMarp> {
  // 空 issues は即返却
  if (input.issues.length === 0) {
    return {
      markdown: input.markdown,
      appliedFixes: 0,
      unsolved: [],
      tokensUsed: { input: 0, output: 0 },
    }
  }

  const client = options.client ?? new Anthropic()
  const model = options.model ?? DEFAULT_MODEL
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const strategy = input.fixStrategy ?? 'minimal'

  const sortedIssues = sortIssues(input.issues)
  const prefill = extractFrontmatter(input.markdown)

  let lastError: SuggesterError | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: buildSystemPrompt(strategy),
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(input.markdown, sortedIssues, strategy),
          },
          { role: 'assistant', content: prefill },
        ],
      })

      const assistantText = extractTextContent(response.content)
      const fixedMarkdown = prefill + assistantText

      validateStructurePreserved(fixedMarkdown, input.markdown)

      return {
        markdown: fixedMarkdown,
        appliedFixes: sortedIssues.length, // MVP: 全試行と仮定
        unsolved: [], // MVP: Phase 2 で構造化出力に置換
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      }
    } catch (e) {
      const error = classifyError(e)
      lastError = error
      if (!error.retryable || attempt === maxAttempts) {
        throw error
      }
      await delay(calcBackoff(attempt))
    }
  }

  throw (
    lastError ??
    new SuggesterError({
      kind: 'api-error',
      retryable: false,
      message: 'Unexpected: no result and no error captured',
    })
  )
}
