/**
 * Atom-McpRelay
 *
 * @modelcontextprotocol/sdk の Server を起動し、stdio 経由で受信した
 * 4 tool (generate_marp / render_marp / detect_issues / suggest_fix) を
 * 依存性注入された core 関数に dispatch する Logic Adapter。
 *
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-McpRelay.md
 */

import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'
import type {
  CallToolResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
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
// Public types (依存性注入 / 起動 / shutdown)
// ─────────────────────────────────────────────────────────────────

export interface McpRelayDeps {
  generateMarp: (input: GenerateInput) => Promise<GeneratedMarp>
  renderMarp: (input: RenderInput) => Promise<RenderOutput>
  detectIssues: (input: DetectInput) => Promise<Issue[]>
  suggestFix: (input: SuggestInput) => Promise<SuggestedMarp>
}

export interface McpRelayOptions {
  /** Server name shown to MCP clients. default '@akitaroh/marp-mcp' */
  serverName?: string
  /** Server version shown to MCP clients. default '0.0.0' */
  serverVersion?: string
  /** Custom transport for testing (default: StdioServerTransport). */
  transport?: Transport
  /**
   * Absolute path to the built board UI HTML (dist/board/marp-board.html).
   * If set, registers the `show_marp` MCP Apps board + its ui:// resource.
   */
  boardHtmlPath?: string
}

export interface McpRelayHandle {
  /** Gracefully close the MCP server. */
  stop(): Promise<void>
}

// ─────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────

export type McpRelayErrorKind = 'init-failed' | 'tool-not-found' | 'core-error'

export class McpRelayError extends Error {
  readonly kind: McpRelayErrorKind
  readonly toolName?: string
  override readonly cause?: unknown
  constructor(opts: {
    kind: McpRelayErrorKind
    message?: string
    toolName?: string
    cause?: unknown
  }) {
    super(opts.message ?? opts.kind)
    this.name = 'McpRelayError'
    this.kind = opts.kind
    this.toolName = opts.toolName
    this.cause = opts.cause
  }
}

// ─────────────────────────────────────────────────────────────────
// zod schemas (tool inputs)
// ─────────────────────────────────────────────────────────────────

const generateSchema = {
  theme: z.string().describe('Theme description (e.g. "B2B AI 導入支援ホワイトペーパー")'),
  outline: z
    .array(z.string())
    .describe('Chapter outline as a list of section titles'),
  requirements: z
    .string()
    .describe('Constraints / requirements (target reader, tone, length, etc.)'),
  themeId: z
    .string()
    .describe('Bundled theme id (e.g. "whitepaper-a4", "slide-16-9", "minimal-mono")'),
  language: z.enum(['ja', 'en']).optional().describe('Output language. default ja'),
}

const renderSchema = {
  markdown: z.string().describe('Marp Markdown source'),
  themePath: z.string().describe('Absolute path to a theme CSS file'),
  format: z
    .enum(['html', 'pdf', 'png', 'pptx'])
    .describe('Output format. pptx requires LibreOffice installed.'),
  outlines: z.boolean().optional().describe('PDF only: generate outlines'),
  notes: z.boolean().optional().describe('PDF only: include speaker notes as annotations'),
  template: z
    .enum(['bespoke', 'bare'])
    .optional()
    .describe('HTML format only: "bespoke" (default, presentation) or "bare" (document)'),
  pageRange: z
    .array(z.number().int().positive())
    .optional()
    .describe('PNG format only: [start, end] 1-indexed page range (2 elements)'),
}

const issueSchema = z.object({
  page: z.number().int().positive(),
  type: z.string(),
  description: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  bboxHint: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
})

const detectSchema = {
  markdown: z.string().describe('Marp Markdown source'),
  themePath: z.string().describe('Absolute path to a theme CSS file'),
  pageRange: z
    .array(z.number().int().positive())
    .optional()
    .describe('[start, end] 1-indexed page range to check (2 elements)'),
  maxIssuesPerPage: z.number().int().positive().optional(),
  severityThreshold: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe('Only return issues at or above this severity'),
}

const suggestSchema = {
  issues: z
    .array(issueSchema)
    .describe('Issues detected by detect_issues (or hand-crafted)'),
  markdown: z.string().describe('Source Marp Markdown to fix'),
  themePath: z.string().describe('Absolute path to the theme CSS file'),
  fixStrategy: z
    .enum(['minimal', 'aggressive'])
    .optional()
    .describe('minimal (default): conservative fixes. aggressive: rewrite freely.'),
}

// ─────────────────────────────────────────────────────────────────
// Result helpers
// ─────────────────────────────────────────────────────────────────

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  }
}

function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}

// ─────────────────────────────────────────────────────────────────
// registerMarpMcpTools — pure registration, no transport
//   (separated for testability; tests can pass a mock server)
// ─────────────────────────────────────────────────────────────────

export function registerMarpMcpTools(
  server: McpServer,
  deps: McpRelayDeps
): void {
  // generate_marp
  server.registerTool(
    'generate_marp',
    {
      description: [
        'Generate Marp Markdown from a theme description, outline, and',
        'requirements. Uses Claude API internally (server-side ANTHROPIC_API_KEY).',
        'Returns the generated markdown and metadata.',
      ].join(' '),
      inputSchema: generateSchema,
    },
    async (args) => {
      try {
        const result = await deps.generateMarp(args as unknown as GenerateInput)
        return jsonResult(result)
      } catch (e) {
        return errorResult((e as Error).message)
      }
    }
  )

  // render_marp
  server.registerTool(
    'render_marp',
    {
      description: [
        'Render Marp Markdown to HTML / PDF / PNG / PPTX via marp-cli.',
        'Returns artifact file path (absolute) for binary formats, or htmlString for html.',
        'Requires a theme CSS path. Use themePath returned from bundled theme list,',
        'or write a custom CSS file and pass its path.',
      ].join(' '),
      inputSchema: renderSchema,
    },
    async (args) => {
      try {
        const result = await deps.renderMarp(args as unknown as RenderInput)
        return jsonResult(result)
      } catch (e) {
        return errorResult((e as Error).message)
      }
    }
  )

  // detect_issues
  server.registerTool(
    'detect_issues',
    {
      description: [
        'Render Marp Markdown to PNG and detect layout/cutoff issues using',
        'a vision LLM (Claude). Returns an array of issues (page / type /',
        'severity / description / bbox). Empty array means no issues found.',
      ].join(' '),
      inputSchema: detectSchema,
    },
    async (args) => {
      try {
        const issues = await deps.detectIssues(args as unknown as DetectInput)
        return jsonResult({ issues })
      } catch (e) {
        return errorResult((e as Error).message)
      }
    }
  )

  // suggest_fix
  server.registerTool(
    'suggest_fix',
    {
      description: [
        'Given detected issues and the source markdown, generate a corrected',
        'Marp Markdown. Use after detect_issues, or pass hand-crafted issues.',
        'Returns the corrected markdown and a list of applied fixes.',
      ].join(' '),
      inputSchema: suggestSchema,
    },
    async (args) => {
      try {
        const result = await deps.suggestFix(args as unknown as SuggestInput)
        return jsonResult(result)
      } catch (e) {
        return errorResult((e as Error).message)
      }
    }
  )
}

// ─────────────────────────────────────────────────────────────────
// registerMarpBoard — MCP Apps 会話内 board (show_marp + ui:// resource)
//   ext-apps の helper で同じ McpServer に登録。boardHtmlPath は
//   ビルド済み board UI (vite-singlefile) の絶対パス（テスト容易性のため注入）。
//   設計: 50_Mission/zddmission/MarpMaker/Atom-MarpBoard.md
// ─────────────────────────────────────────────────────────────────

const BOARD_RESOURCE_URI = 'ui://marp/board.html'

const showSchema = {
  markdown: z
    .string()
    .describe(
      'Marp Markdown to display in the conversation board (rendered client-side with marp-core, paged)'
    ),
}

export function registerMarpBoard(server: McpServer, boardHtmlPath: string): void {
  registerAppTool(
    server,
    'show_marp',
    {
      title: 'Show Marp Board',
      description: [
        'Display Marp Markdown as an interactive paged board inside the',
        'conversation (renders client-side with marp-core). Works in MCP Apps',
        'capable clients (VS Code Copilot / Cursor / ChatGPT / Claude web).',
        'Other clients receive the markdown as text.',
      ].join(' '),
      inputSchema: showSchema,
      _meta: { ui: { resourceUri: BOARD_RESOURCE_URI } },
    },
    async (args): Promise<CallToolResult> => {
      const markdown = (args as { markdown: string }).markdown
      return { content: [{ type: 'text', text: markdown }] }
    }
  )

  registerAppResource(
    server,
    BOARD_RESOURCE_URI,
    BOARD_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readFile(boardHtmlPath, 'utf-8')
      return {
        contents: [
          { uri: BOARD_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      }
    }
  )
}

// ─────────────────────────────────────────────────────────────────
// startMcpServer — create server, register tools, connect transport
// ─────────────────────────────────────────────────────────────────

export async function startMcpServer(
  deps: McpRelayDeps,
  options: McpRelayOptions = {}
): Promise<McpRelayHandle> {
  if (!deps || typeof deps.generateMarp !== 'function') {
    throw new McpRelayError({
      kind: 'init-failed',
      message: 'invalid deps: generateMarp is required',
    })
  }
  if (
    typeof deps.renderMarp !== 'function' ||
    typeof deps.detectIssues !== 'function' ||
    typeof deps.suggestFix !== 'function'
  ) {
    throw new McpRelayError({
      kind: 'init-failed',
      message: 'invalid deps: renderMarp / detectIssues / suggestFix all required',
    })
  }

  const server = new McpServer({
    name: options.serverName ?? '@akitaroh/marp-mcp',
    version: options.serverVersion ?? '0.0.0',
  })

  registerMarpMcpTools(server, deps)
  if (options.boardHtmlPath) {
    registerMarpBoard(server, options.boardHtmlPath)
  }

  const transport = options.transport ?? new StdioServerTransport()
  try {
    await server.connect(transport)
  } catch (e) {
    throw new McpRelayError({
      kind: 'init-failed',
      message: `failed to connect transport: ${(e as Error).message}`,
      cause: e,
    })
  }

  return {
    async stop(): Promise<void> {
      try {
        await server.close()
      } catch {
        /* ignore shutdown errors */
      }
    },
  }
}
