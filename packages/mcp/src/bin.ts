#!/usr/bin/env node
/**
 * MCP server CLI entry for MarpMaker.
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-McpRelay.md / Molecule-mcp-server.md
 *
 * Usage:
 *   npx @akitaroh/marp-mcp                            (after publish)
 *   pnpm --filter @akitaroh/marp-mcp start            (local dev)
 *
 * MCP client config (Claude Code: ~/.claude/mcp.json):
 *   {
 *     "mcpServers": {
 *       "marp": {
 *         "command": "npx",
 *         "args": ["-y", "@akitaroh/marp-mcp"]
 *       }
 *     }
 *   }
 *
 * env:
 *   ANTHROPIC_API_KEY   required for generate_marp / detect_issues / suggest_fix
 *                       (set in the MCP client process, or use Claude Code's
 *                        session-level credentials)
 */

import {
  generateMarp,
  renderMarp,
  detectIssues,
  suggestFix,
} from '@akitaroh/marp-core'
import { startMcpServer } from './relay/mcp-relay.js'

async function main(): Promise<void> {
  // Bind detectIssues' renderer dependency to the real renderMarp here so
  // McpRelay can stay pure (4 deps, no nested options).
  const handle = await startMcpServer({
    generateMarp,
    renderMarp,
    detectIssues: (input) => detectIssues(input, { renderer: renderMarp }),
    suggestFix,
  })

  // stderr because MCP uses stdio for protocol traffic
  console.error('[marp-mcp] MCP server ready on stdio.')

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.error('[marp-mcp] shutting down…')
    await handle.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[marp-mcp] fatal:', err)
  process.exit(1)
})
