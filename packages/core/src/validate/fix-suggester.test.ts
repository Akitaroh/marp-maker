/**
 * ZDD Atom: Atom-FixSuggester のテスト。
 *
 * モック戦略: Anthropic client を依存性注入でモック。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-FixSuggester.md "検証経路" セクション
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

import { suggestFix, SuggesterError, type SuggestInput } from './fix-suggester'
import type { Issue } from './issue-detector'

// ===== ヘルパー =====

function makeMockResponse(text: string): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 200, output_tokens: 800, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null },
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
  const client = { messages: { create } } as unknown as Anthropic
  return { client, create }
}

const originalMarkdown = `---
marp: true
theme: whitepaper-a4
size: A4
paginate: true
---

# Original Title

Original content.

---

# Chapter 2

More content.
`

const sampleIssues: Issue[] = [
  { page: 1, type: 'overflow', description: 'Title overflows', severity: 'high' },
  { page: 2, type: 'contrast', description: 'Low contrast', severity: 'medium' },
]

const baseInput: SuggestInput = {
  issues: sampleIssues,
  markdown: originalMarkdown,
  themePath: '/fake/theme.css',
}

// Claude が返す「prefill の続き」(frontmatter なし、本文のみ)
const fixedContinuation = `
# Fixed Title

Shorter content.

---

# Chapter 2

More content with better contrast.
`

// ===== 空 issues =====

describe('suggestFix - empty issues', () => {
  it('returns original markdown when issues is empty', async () => {
    const { client, create } = makeMockClient(() => makeMockResponse(''))

    const result = await suggestFix(
      { ...baseInput, issues: [] },
      { client, maxAttempts: 1 }
    )

    expect(result.markdown).toBe(originalMarkdown)
    expect(result.appliedFixes).toBe(0)
    expect(result.unsolved).toEqual([])
    expect(result.tokensUsed).toEqual({ input: 0, output: 0 })
    expect(create).not.toHaveBeenCalled()
  })
})

// ===== 正常系 =====

describe('suggestFix - success cases', () => {
  it('returns corrected markdown with applied fixes', async () => {
    const { client } = makeMockClient(() => makeMockResponse(fixedContinuation))

    const result = await suggestFix(baseInput, { client, maxAttempts: 1 })

    expect(result.markdown).toContain('marp: true')
    expect(result.markdown).toContain('theme: whitepaper-a4')
    expect(result.markdown).toContain('Fixed Title')
    expect(result.appliedFixes).toBe(2)
    expect(result.tokensUsed).toEqual({ input: 200, output: 800 })
  })

  it('preserves original frontmatter exactly', async () => {
    const { client } = makeMockClient(() => makeMockResponse(fixedContinuation))

    const result = await suggestFix(baseInput, { client, maxAttempts: 1 })

    // frontmatter (先頭 --- から閉じ --- まで) が完全に元と同じ
    expect(
      result.markdown.startsWith('---\nmarp: true\ntheme: whitepaper-a4\nsize: A4\npaginate: true\n---\n')
    ).toBe(true)
  })

  it('sorts issues by severity (high first) in the prompt', async () => {
    const issues: Issue[] = [
      { page: 1, type: 'layout', description: 'low issue', severity: 'low' },
      { page: 2, type: 'overflow', description: 'high issue', severity: 'high' },
      { page: 3, type: 'contrast', description: 'medium issue', severity: 'medium' },
    ]
    const { client, create } = makeMockClient(() => makeMockResponse(fixedContinuation))

    await suggestFix({ ...baseInput, issues }, { client, maxAttempts: 1 })

    const callArgs = create.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    const userMsg = callArgs.messages[0]?.content as string
    // user prompt 内で high が medium / low より先に出現
    const highIdx = userMsg.indexOf('high issue')
    const medIdx = userMsg.indexOf('medium issue')
    const lowIdx = userMsg.indexOf('low issue')
    expect(highIdx).toBeGreaterThan(-1)
    expect(highIdx).toBeLessThan(medIdx)
    expect(medIdx).toBeLessThan(lowIdx)
  })

  it('passes fixStrategy "aggressive" to system prompt', async () => {
    const { client, create } = makeMockClient(() => makeMockResponse(fixedContinuation))

    await suggestFix(
      { ...baseInput, fixStrategy: 'aggressive' },
      { client, maxAttempts: 1 }
    )

    const callArgs = create.mock.calls[0]?.[0] as { system: string }
    expect(callArgs.system).toContain('aggressive')
  })
})

// ===== 構造検証 =====

describe('suggestFix - structure validation', () => {
  it('throws invalid-output when frontmatter is modified', async () => {
    const corruptedContinuation = `--- MODIFIED FRONTMATTER ---\n# Title`
    const { client } = makeMockClient(() => makeMockResponse(corruptedContinuation))

    // prefill (元 frontmatter) + corruptedContinuation を組み立てる
    // prefill 直後に文字が続くため、検証時には元 frontmatter は壊れない
    // しかし、page breaks 減少で検出される
    const result = await suggestFix(baseInput, { client, maxAttempts: 1 }).catch((e) => e)

    // ページ区切り 1 → 0 になり invalid-output
    expect(result).toBeInstanceOf(SuggesterError)
    expect((result as SuggesterError).kind).toBe('invalid-output')
  })

  it('throws invalid-output when page breaks decrease', async () => {
    // 元は 1 page break (chapter 2 への ---)、修正後は 0 page break
    const noBreakContinuation = `\n# Single Page Only\n\nContent without separators.\n`
    const { client } = makeMockClient(() => makeMockResponse(noBreakContinuation))

    await expect(suggestFix(baseInput, { client, maxAttempts: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-output' })
  })
})

// ===== リトライ =====

describe('suggestFix - retry behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries on rate-limit and succeeds', async () => {
    const rateLimitError = new Anthropic.APIError(429, undefined, 'Rate limited', undefined)
    const { client, create } = makeMockClient((idx) =>
      idx < 1 ? rateLimitError : makeMockResponse(fixedContinuation)
    )

    const promise = suggestFix(baseInput, { client, maxAttempts: 3 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.appliedFixes).toBe(2)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('throws auth-error immediately without retry', async () => {
    const authError = new Anthropic.APIError(401, undefined, 'Unauthorized', undefined)
    const { client, create } = makeMockClient(() => authError)

    await expect(suggestFix(baseInput, { client, maxAttempts: 3 }))
      .rejects.toMatchObject({ kind: 'auth-error', retryable: false })
    expect(create).toHaveBeenCalledTimes(1)
  })
})

// ===== 入力検証 =====

describe('suggestFix - input validation', () => {
  it('throws invalid-output when original markdown has no frontmatter', async () => {
    const noFrontmatterInput = {
      ...baseInput,
      markdown: '# Just a title\n\nNo frontmatter here.',
    }
    const { client } = makeMockClient(() => makeMockResponse(fixedContinuation))

    await expect(suggestFix(noFrontmatterInput, { client, maxAttempts: 1 }))
      .rejects.toMatchObject({ kind: 'invalid-output' })
  })
})
