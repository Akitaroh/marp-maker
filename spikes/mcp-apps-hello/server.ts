/**
 * 検証1: hello-world MCP App server (stdio)
 *
 * 目的: Claude Desktop で ui:// iframe が描画され、app.connect() の handshake が
 * 通るか（= issue #165 を踏まないか）を最小構成で確かめる。
 *
 * Run: npm run build && npm run start:stdio
 * MCP client 登録は README 参照。
 */
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

// vite build の出力（dist/mcp-app.html）を読む
const DIST_DIR = path.join(import.meta.dirname, "dist");
const resourceUri = "ui://hello/mcp-app.html";

const server = new McpServer({
  name: "MCP Apps Hello (spike)",
  version: "0.0.1",
});

// UI metadata 付き tool。Host は _meta.ui.resourceUri を見て UI を fetch・描画する
registerAppTool(
  server,
  "hello_board",
  {
    title: "Hello Board",
    description: "会話内に hello-world の MCP App board を表示する（検証用）。",
    inputSchema: {},
    _meta: { ui: { resourceUri } },
  },
  async (): Promise<CallToolResult> => {
    return {
      content: [
        {
          type: "text",
          text: `Hello from the MCP server at ${new Date().toISOString()}`,
        },
      ],
    };
  },
);

// UI resource（bundle 済み 1 HTML）を返す
registerAppResource(
  server,
  resourceUri,
  resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => {
    const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
    return {
      contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

// --- 検証2: marp-core を iframe 内で描画（issue #652 = eval/CSP 制約に抵触するか）---
const marpResourceUri = "ui://marp/marp-app.html";

registerAppTool(
  server,
  "marp_board",
  {
    title: "Marp Board",
    description:
      "marp markdown を会話内 board に描画する（marp-core を iframe 内で実行、検証用）。",
    inputSchema: {},
    _meta: { ui: { resourceUri: marpResourceUri } },
  },
  async (): Promise<CallToolResult> => {
    return {
      content: [
        {
          type: "text",
          text: `# Marp via tool result（1/3）

これは **marp_board ツールが返した複数ページ markdown** を board が marp-core で描画したもの。◀▶ で送れる。

---

# ページ送り（2/3）

iframe 内 JS が marp-core の出力スライドを 1 枚ずつ出し分けている。

- tool が返した markdown がそのまま board に流れた
- AI → board のデータフローも動いている

---

# 配布層の土台（3/3）

これが v2 の「会話内 board」。MCP Apps 対応クライアント（VS Code / Cursor / ChatGPT / Claude web）で動く。

- issue #165・#652 両方クリア済み
- 次はライブ編集 + PDF 出力ボタン + AI 同期
`,
        },
      ],
    };
  },
);

registerAppResource(
  server,
  marpResourceUri,
  marpResourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => {
    const html = await fs.readFile(path.join(DIST_DIR, "marp-app.html"), "utf-8");
    return {
      contents: [
        { uri: marpResourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  },
);

// 接続してきた host が MCP Apps (io.modelcontextprotocol/ui) を negotiate するか記録。
// これで「Claude Code 面で iframe が出るか」を目視せず確実に判定できる。
const CAPS_LOG = path.join(import.meta.dirname, ".client-caps.jsonl");
server.server.oninitialized = () => {
  const info = server.server.getClientVersion();
  const caps = server.server.getClientCapabilities();
  const mcpAppsDeclared = !!(caps as { extensions?: Record<string, unknown> })
    ?.extensions?.["io.modelcontextprotocol/ui"];
  const payload = {
    at: new Date().toISOString(),
    client: info,
    mcpAppsDeclared,
    capabilities: caps,
  };
  fs.appendFile(CAPS_LOG, JSON.stringify(payload) + "\n").catch(() => {});
};

await server.connect(new StdioServerTransport());
