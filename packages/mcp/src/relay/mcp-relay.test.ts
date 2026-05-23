/**
 * Atom-McpRelay tests.
 *
 * Tests use a MockServer that captures registerTool calls so we can invoke
 * tool handlers directly without spinning up a real MCP transport.
 * Pattern borrowed from @akitaroh/mermaid-mcp.
 *
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-McpRelay.md
 *       / Bond-McpRelay{Ai,Render,Detect,Suggest}Call.md
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerMarpMcpTools, startMcpServer, McpRelayError } from './mcp-relay.js'
import type { McpRelayDeps } from './mcp-relay.js'
import type {
  GenerateInput,
  GeneratedMarp,
  RenderInput,
  RenderOutput,
  DetectInput,
  Issue,
  SuggestInput,
  SuggestedMarp,
} from '@akitaroh/marp-core'

// ─────────────────────────────────────────────────────────────────
// MockServer (captures registerTool, lets us invoke handlers)
// ─────────────────────────────────────────────────────────────────

type RegisteredTool = {
  name: string
  config: { description?: string; inputSchema?: unknown }
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>
    isError?: boolean
  }>
}

function createMockServer(): {
  server: Parameters<typeof registerMarpMcpTools>[0]
  invoke: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<{ result: { isError?: boolean }; json: unknown }>
  has: (name: string) => boolean
  listToolNames: () => string[]
  getDescription: (name: string) => string | undefined
} {
  const tools: Record<string, RegisteredTool> = {}
  const fakeServer = {
    registerTool(name: string, config: unknown, handler: unknown) {
      tools[name] = {
        name,
        config: config as RegisteredTool['config'],
        handler: handler as RegisteredTool['handler'],
      }
    },
  }
  return {
    server: fakeServer as unknown as Parameters<typeof registerMarpMcpTools>[0],
    invoke: async (name: string, args: Record<string, unknown> = {}) => {
      const t = tools[name]
      if (!t) throw new Error(`tool not registered: ${name}`)
      const r = await t.handler(args)
      const text = r.content.map((c) => c.text).join('\n')
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        json = text
      }
      return { result: r, json }
    },
    has: (name: string) => name in tools,
    listToolNames: () => Object.keys(tools),
    getDescription: (name: string) => tools[name]?.config.description,
  }
}

// ─────────────────────────────────────────────────────────────────
// Mock deps
// ─────────────────────────────────────────────────────────────────

function makeMockDeps(): {
  deps: McpRelayDeps
  spies: {
    generateMarp: ReturnType<typeof vi.fn>
    renderMarp: ReturnType<typeof vi.fn>
    detectIssues: ReturnType<typeof vi.fn>
    suggestFix: ReturnType<typeof vi.fn>
  }
} {
  const generated: GeneratedMarp = {
    markdown: '---\nmarp: true\n---\n# generated\n',
    metadata: { tokens: 100, model: 'claude-mock', attempts: 1 } as unknown as GeneratedMarp['metadata'],
  }
  const rendered: RenderOutput = { format: 'pdf', filePath: '/tmp/mock.pdf' }
  const issues: Issue[] = [
    {
      page: 1,
      type: 'overflow',
      description: 'text overflows',
      severity: 'high',
    },
  ]
  const suggested: SuggestedMarp = {
    markdown: '---\nmarp: true\n---\n# fixed\n',
    appliedFixes: [{ issueIndex: 0, description: 'shortened text' }] as unknown as SuggestedMarp['appliedFixes'],
  }

  const generateMarp = vi.fn(
    async (_input: GenerateInput): Promise<GeneratedMarp> => generated
  )
  const renderMarp = vi.fn(
    async (_input: RenderInput): Promise<RenderOutput> => rendered
  )
  const detectIssues = vi.fn(
    async (_input: DetectInput): Promise<Issue[]> => issues
  )
  const suggestFix = vi.fn(
    async (_input: SuggestInput): Promise<SuggestedMarp> => suggested
  )

  return {
    deps: { generateMarp, renderMarp, detectIssues, suggestFix },
    spies: { generateMarp, renderMarp, detectIssues, suggestFix },
  }
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe('registerMarpMcpTools', () => {
  let mock: ReturnType<typeof createMockServer>
  let spies: ReturnType<typeof makeMockDeps>['spies']

  beforeEach(() => {
    mock = createMockServer()
    const m = makeMockDeps()
    spies = m.spies
    registerMarpMcpTools(mock.server, m.deps)
  })

  it('registers all 4 tool names', () => {
    expect(mock.listToolNames().sort()).toEqual(
      ['detect_issues', 'generate_marp', 'render_marp', 'suggest_fix'].sort()
    )
  })

  it('each tool has a non-empty description', () => {
    for (const name of ['generate_marp', 'render_marp', 'detect_issues', 'suggest_fix']) {
      const desc = mock.getDescription(name)
      expect(desc, `${name} description`).toBeDefined()
      expect(desc!.length).toBeGreaterThan(20)
    }
  })

  // ─── generate_marp ────────────────────────────────────────────
  describe('generate_marp dispatch (Bond-McpRelayAiCall)', () => {
    it('calls deps.generateMarp with the args and returns markdown', async () => {
      const args = {
        theme: 'B2B AI ホワイトペーパー',
        outline: ['intro', 'method'],
        requirements: 'A4 縦、3 ページ以内',
        themeId: 'whitepaper-a4',
      }
      const { result, json } = await mock.invoke('generate_marp', args)
      expect(result.isError).toBeFalsy()
      expect(spies.generateMarp).toHaveBeenCalledOnce()
      expect(spies.generateMarp).toHaveBeenCalledWith(args)
      expect((json as { markdown: string }).markdown).toContain('# generated')
    })

    it('returns isError when generateMarp throws', async () => {
      spies.generateMarp.mockRejectedValueOnce(new Error('API quota'))
      const { result } = await mock.invoke('generate_marp', {
        theme: 't',
        outline: ['a'],
        requirements: 'r',
        themeId: 'whitepaper-a4',
      })
      expect(result.isError).toBe(true)
    })
  })

  // ─── render_marp ──────────────────────────────────────────────
  describe('render_marp dispatch (Bond-McpRelayRenderCall)', () => {
    it('calls deps.renderMarp and returns artifact path', async () => {
      const args = {
        markdown: '---\nmarp: true\n---\n# hi\n',
        themePath: '/tmp/theme.css',
        format: 'pdf',
      }
      const { result, json } = await mock.invoke('render_marp', args)
      expect(result.isError).toBeFalsy()
      expect(spies.renderMarp).toHaveBeenCalledOnce()
      expect((json as { filePath: string }).filePath).toBe('/tmp/mock.pdf')
    })

    it('returns isError when renderMarp throws', async () => {
      spies.renderMarp.mockRejectedValueOnce(new Error('chrome not found'))
      const { result } = await mock.invoke('render_marp', {
        markdown: 'x',
        themePath: '/tmp/theme.css',
        format: 'pdf',
      })
      expect(result.isError).toBe(true)
    })
  })

  // ─── detect_issues ────────────────────────────────────────────
  describe('detect_issues dispatch (Bond-McpRelayDetectCall)', () => {
    it('calls deps.detectIssues and returns issues array', async () => {
      const args = {
        markdown: '---\nmarp: true\n---\n# hi\n',
        themePath: '/tmp/theme.css',
      }
      const { result, json } = await mock.invoke('detect_issues', args)
      expect(result.isError).toBeFalsy()
      expect(spies.detectIssues).toHaveBeenCalledOnce()
      const issues = (json as { issues: Issue[] }).issues
      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('high')
    })

    it('returns isError when detectIssues throws', async () => {
      spies.detectIssues.mockRejectedValueOnce(new Error('vision API failed'))
      const { result } = await mock.invoke('detect_issues', {
        markdown: 'x',
        themePath: '/tmp/theme.css',
      })
      expect(result.isError).toBe(true)
    })
  })

  // ─── suggest_fix ──────────────────────────────────────────────
  describe('suggest_fix dispatch (Bond-McpRelaySuggestCall)', () => {
    it('calls deps.suggestFix and returns corrected markdown', async () => {
      const args = {
        issues: [
          {
            page: 1,
            type: 'overflow',
            description: 'text overflows',
            severity: 'high',
          },
        ],
        markdown: '---\nmarp: true\n---\n# original\n',
        themePath: '/tmp/theme.css',
      }
      const { result, json } = await mock.invoke('suggest_fix', args)
      expect(result.isError).toBeFalsy()
      expect(spies.suggestFix).toHaveBeenCalledOnce()
      expect((json as { markdown: string }).markdown).toContain('# fixed')
    })

    it('returns isError when suggestFix throws', async () => {
      spies.suggestFix.mockRejectedValueOnce(new Error('rate limit'))
      const { result } = await mock.invoke('suggest_fix', {
        issues: [],
        markdown: 'x',
        themePath: '/tmp/theme.css',
      })
      expect(result.isError).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────────
// startMcpServer guard tests (no real transport)
// ─────────────────────────────────────────────────────────────────

describe('startMcpServer dep validation', () => {
  it('throws McpRelayError("init-failed") when deps is empty', async () => {
    await expect(
      startMcpServer({} as McpRelayDeps)
    ).rejects.toBeInstanceOf(McpRelayError)
  })

  it('throws McpRelayError("init-failed") when generateMarp is missing', async () => {
    const { deps } = makeMockDeps()
    const broken = { ...deps, generateMarp: undefined as unknown as McpRelayDeps['generateMarp'] }
    await expect(
      startMcpServer(broken)
    ).rejects.toMatchObject({ kind: 'init-failed' })
  })

  it('throws McpRelayError("init-failed") when any of the other 3 deps is missing', async () => {
    const { deps } = makeMockDeps()
    const broken = { ...deps, renderMarp: undefined as unknown as McpRelayDeps['renderMarp'] }
    await expect(
      startMcpServer(broken)
    ).rejects.toMatchObject({ kind: 'init-failed' })
  })
})
