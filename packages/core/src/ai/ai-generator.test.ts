/**
 * ZDD Atom: Atom-AiGenerator のテスト。
 *
 * モック戦略: Anthropic client を依存性注入 (AiGeneratorOptions.client) でモック。
 * 統合テスト (実 Claude API) は RUN_INTEGRATION=1 + ANTHROPIC_API_KEY のときのみ実行。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-AiGenerator.md "検証経路" セクション
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

import { generateMarp, AiGeneratorError, type GenerateInput } from './ai-generator'

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1'

const validInput: GenerateInput = {
  theme: 'AI 駆動開発の生産性向上',
  outline: ['課題提起', '現状分析', '提案', 'まとめ'],
  requirements: 'B2B SaaS 企業向け',
  themeId: 'whitepaper-a4',
  language: 'ja',
}

/**
 * Claude API が prefill の続きとして返す「本文部分」を生成。
 * 完全な markdown = prefill (frontmatter) + この戻り値。
 */
function buildAssistantContinuation(outline: string[]): string {
  const pages = outline.map((s, i) => `# ${i + 1}. ${s}\n\n本文サンプル。`).join('\n\n---\n\n')
  return `# タイトル\n\n${pages}`
}

function makeMockResponse(text: string): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 500, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null },
  } as unknown as Anthropic.Messages.Message
}

function makeMockClient(
  createImpl: (callIndex: number) => Promise<unknown> | unknown
): { client: Anthropic; create: ReturnType<typeof vi.fn> } {
  let callIndex = 0
  const create = vi.fn(async () => {
    const idx = callIndex++
    const result = await createImpl(idx)
    if (result instanceof Error) throw result
    return result
  })
  const client = {
    messages: { create },
  } as unknown as Anthropic
  return { client, create }
}

// ===== 正常系 =====

describe('generateMarp - success cases', () => {
  it('returns valid GeneratedMarp on success', async () => {
    const { client, create } = makeMockClient(() =>
      makeMockResponse(buildAssistantContinuation(validInput.outline))
    )

    const result = await generateMarp(validInput, { client, maxAttempts: 1 })

    expect(result.markdown).toContain('marp: true')
    expect(result.markdown).toContain('theme: whitepaper-a4')
    expect(result.markdown).toContain('size: A4')
    expect(result.usedThemeId).toBe('whitepaper-a4')
    expect(result.tokensUsed).toEqual({ input: 100, output: 500 })
    expect(result.model).toBe('claude-sonnet-4-5-20250929')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('includes assistant prefill in returned markdown', async () => {
    const { client } = makeMockClient(() =>
      makeMockResponse(buildAssistantContinuation(validInput.outline))
    )

    const result = await generateMarp(validInput, { client, maxAttempts: 1 })

    // prefill (marp: true から始まる frontmatter) が含まれる
    expect(result.markdown.startsWith('---\nmarp: true')).toBe(true)
  })

  it('uses english prompt when language is en', async () => {
    const { client, create } = makeMockClient(() =>
      makeMockResponse(buildAssistantContinuation(validInput.outline))
    )

    await generateMarp({ ...validInput, language: 'en' }, { client, maxAttempts: 1 })

    const callArgs = create.mock.calls[0]?.[0] as { system: string }
    expect(callArgs.system).toContain('expert whitepaper writer')
  })
})

// ===== リトライ =====

describe('generateMarp - retry behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries on rate-limit and succeeds', async () => {
    const rateLimitError = new Anthropic.APIError(429, undefined, 'Rate limited', undefined)
    const { client, create } = makeMockClient((idx) =>
      idx < 2 ? rateLimitError : makeMockResponse(buildAssistantContinuation(validInput.outline))
    )

    const promise = generateMarp(validInput, { client, maxAttempts: 3 })

    // バックオフを進める
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result.usedThemeId).toBe('whitepaper-a4')
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('throws after exceeding maxAttempts on retryable errors', async () => {
    const rateLimitError = new Anthropic.APIError(429, undefined, 'Rate limited', undefined)
    const { client, create } = makeMockClient(() => rateLimitError)

    const promise = generateMarp(validInput, { client, maxAttempts: 2 }).catch((e) => e)

    await vi.runAllTimersAsync()

    const err = await promise
    expect(err).toBeInstanceOf(AiGeneratorError)
    expect((err as AiGeneratorError).kind).toBe('rate-limit')
    expect(create).toHaveBeenCalledTimes(2)
  })
})

// ===== 非リトライエラー =====

describe('generateMarp - non-retryable errors', () => {
  it('throws auth-error immediately on 401 without retry', async () => {
    const authError = new Anthropic.APIError(401, undefined, 'Unauthorized', undefined)
    const { client, create } = makeMockClient(() => authError)

    await expect(generateMarp(validInput, { client, maxAttempts: 3 }))
      .rejects.toMatchObject({ kind: 'auth-error', retryable: false })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('throws auth-error on 403', async () => {
    const forbiddenError = new Anthropic.APIError(403, undefined, 'Forbidden', undefined)
    const { client } = makeMockClient(() => forbiddenError)

    await expect(generateMarp(validInput, { client, maxAttempts: 3 }))
      .rejects.toMatchObject({ kind: 'auth-error' })
  })
})

// ===== 出力検証 =====

describe('generateMarp - output validation', () => {
  // NOTE: prefill により frontmatter (marp: true / theme / size) は構造的に保証される。
  // 検証で失敗するのは「prefill の続きが invalid」のケース（ページ区切り不足等）。

  it('throws invalid-output when page breaks are insufficient', async () => {
    // outline 4 章だが prefill の後に 1 ページのみ
    const { client } = makeMockClient(() => makeMockResponse('# Only one page'))

    await expect(generateMarp(validInput, { client, maxAttempts: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-output' })
  })

  it('does not retry on invalid-output (non-retryable)', async () => {
    const { client, create } = makeMockClient(() => makeMockResponse('# Only one page'))

    await expect(generateMarp(validInput, { client, maxAttempts: 3 }))
      .rejects.toMatchObject({ kind: 'invalid-output' })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('throws invalid-output when assistant response is empty', async () => {
    const { client } = makeMockClient(() => makeMockResponse(''))

    await expect(generateMarp(validInput, { client, maxAttempts: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-output' })
  })
})

// ===== 統合テスト (実 Claude API) =====

describe.skipIf(!RUN_INTEGRATION || !process.env.ANTHROPIC_API_KEY)(
  'generateMarp - integration (real Claude API)',
  () => {
    it('generates a valid whitepaper from real API', async () => {
      const result = await generateMarp(validInput)

      expect(result.markdown).toContain('marp: true')
      expect(result.markdown).toContain('theme: whitepaper-a4')
      expect(result.markdown).toContain('size: A4')
      expect(result.tokensUsed.output).toBeGreaterThan(0)
    }, 60_000)
  }
)
