/**
 * ZDD Atom: Atom-IssueDetector のテスト。
 *
 * モック戦略:
 * - Anthropic client: 依存性注入 (`IssueDetectorOptions.client`) でモック
 * - renderer (MarpRenderer): 依存性注入 (`IssueDetectorOptions.renderer`) でモック
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-IssueDetector.md "検証経路" セクション
 */

import { describe, it, expect, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'

import { detectIssues, type DetectInput, type RendererFn } from './issue-detector'

// ===== ヘルパー =====

function makePng(): Buffer {
  // 8 byte PNG マジック + 適当な内容 (validation は通る最小限)
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
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
    usage: { input_tokens: 100, output_tokens: 200, cache_creation_input_tokens: null, cache_read_input_tokens: null, server_tool_use: null, service_tier: null },
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

function makeMockRenderer(pageCount: number): RendererFn {
  return vi.fn(async (input) => {
    if (input.format !== 'png') throw new Error('expected png format')
    const buffers = Array.from({ length: pageCount }, () => makePng())
    if (input.pageRange) {
      const [start, end] = input.pageRange
      return { format: 'png', pngBuffers: buffers.slice(start - 1, end) }
    }
    return { format: 'png', pngBuffers: buffers }
  })
}

const baseInput: DetectInput = {
  markdown: '# Test\n\n---\n\n# Page2',
  themePath: '/fake/theme.css',
}

// ===== 正常系 =====

describe('detectIssues - success cases', () => {
  it('returns parsed issues from API response', async () => {
    const apiResponse = JSON.stringify([
      { page: 1, type: 'overflow', description: 'Text overflows the slide', severity: 'high' },
      { page: 2, type: 'contrast', description: 'Low contrast on subtitle', severity: 'medium' },
    ])
    const { client } = makeMockClient(() => makeMockResponse(apiResponse))
    const renderer = makeMockRenderer(2)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toHaveLength(2)
    expect(issues[0]).toMatchObject({ page: 1, type: 'overflow', severity: 'high' })
    expect(issues[1]).toMatchObject({ page: 2, type: 'contrast', severity: 'medium' })
  })

  it('returns empty array when API returns []', async () => {
    const { client } = makeMockClient(() => makeMockResponse('[]'))
    const renderer = makeMockRenderer(2)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toEqual([])
  })

  it('extracts JSON array even when wrapped in prose', async () => {
    // AI が「Here are the issues: [...]」みたいに返すケース
    const response = `Here are the issues I found:\n[{"page":1,"type":"overflow","description":"Overflows","severity":"high"}]\nThat's all.`
    const { client } = makeMockClient(() => makeMockResponse(response))
    const renderer = makeMockRenderer(1)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.type).toBe('overflow')
  })
})

// ===== chunk 分割 =====

describe('detectIssues - chunking', () => {
  it('splits into 20-page chunks and makes multiple API calls', async () => {
    // 25 ページ → 2 chunk (20 + 5)
    const renderer = makeMockRenderer(25)
    const { client, create } = makeMockClient((idx) =>
      makeMockResponse(
        JSON.stringify([
          {
            page: idx === 0 ? 1 : 21,
            type: 'layout',
            description: `chunk ${idx} issue`,
            severity: 'low',
          },
        ])
      )
    )

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(create).toHaveBeenCalledTimes(2)
    expect(issues).toHaveLength(2)
    expect(issues[0]?.page).toBe(1)
    expect(issues[1]?.page).toBe(21)
  })

  it('applies pageRange to renderer', async () => {
    const renderer = makeMockRenderer(10)
    const { client } = makeMockClient(() => makeMockResponse('[]'))

    await detectIssues(
      { ...baseInput, pageRange: [3, 5] },
      { client, renderer }
    )

    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({ pageRange: [3, 5] })
    )
  })
})

// ===== fail-soft =====

describe('detectIssues - fail-soft', () => {
  it('returns empty array when renderer throws', async () => {
    const renderer = vi.fn(async () => {
      throw new Error('marp-cli not available')
    })
    const { client, create } = makeMockClient(() => makeMockResponse('[]'))

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it('returns empty array when API throws', async () => {
    const { client } = makeMockClient(() => new Error('API down'))
    const renderer = makeMockRenderer(2)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toEqual([])
  })

  it('returns empty array when JSON parse fails', async () => {
    const { client } = makeMockClient(() => makeMockResponse('not valid JSON at all'))
    const renderer = makeMockRenderer(2)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toEqual([])
  })

  it('continues processing other chunks when one chunk fails', async () => {
    const renderer = makeMockRenderer(25) // 2 chunk
    const { client } = makeMockClient((idx) => {
      if (idx === 0) return new Error('chunk 1 failed')
      return makeMockResponse(
        JSON.stringify([{ page: 21, type: 'overflow', description: 'issue', severity: 'high' }])
      )
    })

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.page).toBe(21)
  })
})

// ===== severity / maxIssuesPerPage =====

describe('detectIssues - filtering', () => {
  it('applies severityThreshold to exclude low-severity issues', async () => {
    const apiResponse = JSON.stringify([
      { page: 1, type: 'overflow', description: 'high issue', severity: 'high' },
      { page: 1, type: 'contrast', description: 'medium issue', severity: 'medium' },
      { page: 1, type: 'layout', description: 'low issue', severity: 'low' },
    ])
    const { client } = makeMockClient(() => makeMockResponse(apiResponse))
    const renderer = makeMockRenderer(1)

    const issues = await detectIssues(
      { ...baseInput, severityThreshold: 'high' },
      { client, renderer }
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]?.severity).toBe('high')
  })

  it('truncates issues per page to maxIssuesPerPage', async () => {
    const apiResponse = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({
        page: 1,
        type: 'layout',
        description: `issue ${i}`,
        severity: 'low',
      }))
    )
    const { client } = makeMockClient(() => makeMockResponse(apiResponse))
    const renderer = makeMockRenderer(1)

    const issues = await detectIssues(
      { ...baseInput, maxIssuesPerPage: 3 },
      { client, renderer }
    )

    expect(issues).toHaveLength(3)
  })

  it('drops items with missing description', async () => {
    const apiResponse = JSON.stringify([
      { page: 1, type: 'overflow', severity: 'high' }, // description なし
      { page: 1, type: 'layout', description: 'valid', severity: 'low' },
    ])
    const { client } = makeMockClient(() => makeMockResponse(apiResponse))
    const renderer = makeMockRenderer(1)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toHaveLength(1)
    expect(issues[0]?.description).toBe('valid')
  })

  it('defaults unknown type to "other" and unknown severity to "medium"', async () => {
    const apiResponse = JSON.stringify([
      { page: 1, type: 'unknown-type', description: 'x', severity: 'critical' },
    ])
    const { client } = makeMockClient(() => makeMockResponse(apiResponse))
    const renderer = makeMockRenderer(1)

    const issues = await detectIssues(baseInput, { client, renderer })

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ type: 'other', severity: 'medium' })
  })
})
