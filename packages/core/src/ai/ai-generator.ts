/**
 * ZDD Atom: Atom-AiGenerator (Logic Adapter)
 * Claude API 直叩きで Marp Markdown を生成する。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-AiGenerator.md
 *
 * - 入力: GenerateInput (theme / outline / requirements / themeId / language?)
 * - 出力: GeneratedMarp (markdown / usedThemeId / tokensUsed / model)
 * - 副作用: Claude API への HTTPS 呼出 (@anthropic-ai/sdk)
 * - API キー: 環境変数 ANTHROPIC_API_KEY (呼出側で設定)
 */

import Anthropic from '@anthropic-ai/sdk'

// ===== 入力型 =====

export interface GenerateInput {
  theme: string
  outline: string[]
  requirements: string
  themeId: string
  language?: 'ja' | 'en'
}

// ===== 出力型 =====

export interface GeneratedMarp {
  markdown: string
  usedThemeId: string
  tokensUsed: { input: number; output: number }
  model: string
}

// ===== エラー型 =====

export type AiGeneratorErrorKind =
  | 'api-error'
  | 'rate-limit'
  | 'invalid-output'
  | 'timeout'
  | 'auth-error'

interface AiGeneratorErrorOpts {
  kind: AiGeneratorErrorKind
  retryable: boolean
  cause?: unknown
  message?: string
}

export class AiGeneratorError extends Error {
  readonly kind: AiGeneratorErrorKind
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(opts: AiGeneratorErrorOpts) {
    super(opts.message ?? `[${opts.kind}]${opts.retryable ? ' (retryable)' : ''}`)
    this.name = 'AiGeneratorError'
    this.kind = opts.kind
    this.retryable = opts.retryable
    this.cause = opts.cause
  }
}

// ===== オプション =====

export interface AiGeneratorOptions {
  /** Anthropic client (DI 用、テスト時はモック注入) */
  client?: Anthropic
  /** model id (default: claude-sonnet-4-5-20250929) */
  model?: string
  /** リトライ最大回数 (default: 3) */
  maxAttempts?: number
  /** max_tokens (default: 8000) */
  maxTokens?: number
}

// ===== 内部定数 =====

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_MAX_TOKENS = 8000
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 8000

// ===== プロンプト構築 =====

function buildSystemPrompt(language: 'ja' | 'en'): string {
  if (language === 'en') {
    return `You are an expert whitepaper writer specializing in Marp Markdown format.

OUTPUT RULES (strict):
- Output ONLY a complete Marp Markdown document, nothing else
- Start with frontmatter: marp: true, theme: <given>, size: A4, paginate: true
- Use --- as page separator
- Use h1/h2/h3 headings only (no h4-h6)
- Use blockquotes (>) for emphasis, lists for enumeration
- No HTML tags except <br> for line breaks
- Each chapter from the outline must have at least one page`
  }
  return `あなたはホワイトペーパー作成の専門家。Marp Markdown 形式で出力する。

出力ルール（厳守）:
- 出力は完全な Marp Markdown 文書のみ。説明文や前置きは禁止
- frontmatter は marp: true / theme: <指定値> / size: A4 / paginate: true を必ず含む
- ページ区切りは ---
- 見出しは h1/h2/h3 のみ (h4-h6 禁止)
- 強調は blockquote (>)、列挙はリストを使う
- HTML タグは <br> 以外禁止
- outline の各章は最低 1 ページ`
}

function buildUserPrompt(input: GenerateInput): string {
  const lang = input.language ?? 'ja'
  if (lang === 'en') {
    return `Generate a whitepaper with the following parameters.

# Theme
${input.theme}

# Outline (in order)
${input.outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}

# Requirements
${input.requirements || '(none)'}

# Theme ID
${input.themeId}

Output the complete Marp Markdown document.`
  }
  return `以下のパラメータでホワイトペーパーを生成してください。

# テーマ
${input.theme}

# 章立て (順序通り)
${input.outline.map((s, i) => `${i + 1}. ${s}`).join('\n')}

# 要件
${input.requirements || '(なし)'}

# テーマ ID
${input.themeId}

完全な Marp Markdown 文書を出力してください。`
}

function buildAssistantPrefill(themeId: string): string {
  return `---
marp: true
theme: ${themeId}
size: A4
paginate: true
---

`
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

function validateOutput(markdown: string, input: GenerateInput): void {
  if (!/^marp:\s*true\b/m.test(markdown)) {
    throw new AiGeneratorError({
      kind: 'invalid-output',
      retryable: false,
      message: 'Missing "marp: true" in frontmatter',
    })
  }
  if (!new RegExp(`^theme:\\s*${input.themeId}\\b`, 'm').test(markdown)) {
    throw new AiGeneratorError({
      kind: 'invalid-output',
      retryable: false,
      message: `Missing "theme: ${input.themeId}" in frontmatter`,
    })
  }
  if (!/^size:\s*A4\b/m.test(markdown)) {
    throw new AiGeneratorError({
      kind: 'invalid-output',
      retryable: false,
      message: 'Missing "size: A4" in frontmatter',
    })
  }
  // ページ区切りカウント (frontmatter の閉じ --- を除いた数)
  const dashCount = (markdown.match(/^---\s*$/gm) ?? []).length
  const pageBreaks = Math.max(0, dashCount - 1)
  if (pageBreaks < input.outline.length) {
    throw new AiGeneratorError({
      kind: 'invalid-output',
      retryable: false,
      message: `Insufficient page breaks: expected >= ${input.outline.length}, got ${pageBreaks}`,
    })
  }
}

function classifyError(e: unknown): AiGeneratorError {
  if (e instanceof AiGeneratorError) return e

  // Anthropic.APIError 系の判定
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401 || e.status === 403) {
      return new AiGeneratorError({
        kind: 'auth-error',
        retryable: false,
        cause: e,
        message: `Authentication failed (HTTP ${e.status})`,
      })
    }
    if (e.status === 429) {
      return new AiGeneratorError({
        kind: 'rate-limit',
        retryable: true,
        cause: e,
        message: 'Rate limited (HTTP 429)',
      })
    }
    if (e.status != null && e.status >= 500) {
      return new AiGeneratorError({
        kind: 'api-error',
        retryable: true,
        cause: e,
        message: `Server error (HTTP ${e.status})`,
      })
    }
    return new AiGeneratorError({
      kind: 'api-error',
      retryable: false,
      cause: e,
      message: `API error (HTTP ${e.status ?? 'unknown'})`,
    })
  }

  // Timeout 判定
  const err = e as { name?: string; code?: string }
  if (err?.name === 'AbortError' || err?.code === 'ETIMEDOUT') {
    return new AiGeneratorError({
      kind: 'timeout',
      retryable: true,
      cause: e,
    })
  }

  return new AiGeneratorError({
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
 * ユーザー入力から Claude API 経由で Marp Markdown を生成する。
 *
 * リトライポリシー:
 * - rate-limit / api-error (5xx) / timeout は最大 maxAttempts 回までリトライ
 * - exp backoff (base 1000ms, max 8000ms)
 * - auth-error / invalid-output / api-error (4xx) は非リトライで即 throw
 *
 * 出力検証:
 * - frontmatter に marp: true / theme: <themeId> / size: A4 必須
 * - ページ区切り --- が outline.length 以上
 * - 違反時は invalid-output で throw (リトライしない、設計の問題)
 */
export async function generateMarp(
  input: GenerateInput,
  options: AiGeneratorOptions = {}
): Promise<GeneratedMarp> {
  const client = options.client ?? new Anthropic()
  const model = options.model ?? DEFAULT_MODEL
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const language = input.language ?? 'ja'
  const prefill = buildAssistantPrefill(input.themeId)

  let lastError: AiGeneratorError | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: buildSystemPrompt(language),
        messages: [
          { role: 'user', content: buildUserPrompt(input) },
          { role: 'assistant', content: prefill },
        ],
      })

      const assistantText = extractTextContent(response.content)
      const markdown = prefill + assistantText

      validateOutput(markdown, input)

      return {
        markdown,
        usedThemeId: input.themeId,
        tokensUsed: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        model: response.model,
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

  // ここには到達しないが TypeScript 上の安全網
  throw (
    lastError ??
    new AiGeneratorError({
      kind: 'api-error',
      retryable: false,
      message: 'Unexpected: no result and no error captured',
    })
  )
}
