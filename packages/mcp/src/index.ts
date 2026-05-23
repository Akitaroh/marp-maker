/**
 * @akitaroh/marp-mcp
 *
 * MCP server for MarpMaker. Exposes 4 tools (generate_marp / render_marp /
 * detect_issues / suggest_fix) over stdio.
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/
 * - Atom-McpRelay.md
 * - Molecule-mcp-server.md
 */

export {
  startMcpServer,
  registerMarpMcpTools,
  McpRelayError,
} from './relay/mcp-relay.js'
export type {
  McpRelayDeps,
  McpRelayOptions,
  McpRelayHandle,
  McpRelayErrorKind,
} from './relay/mcp-relay.js'
