/**
 * stdio 越し JSON-RPC smoke test。
 * サーバー側（protocol レベル）を AI が自律検証できる範囲を確かめる:
 *   initialize → tools/list(_meta.ui.resourceUri) → resources/list → resources/read → tools/call
 * iframe 描画自体は Claude Desktop でしか見えないのでここでは対象外。
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(here, "..");

const child = spawn("npx", ["tsx", "server.ts"], {
  cwd,
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 8000);
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const checks = [];
function check(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

try {
  // 1. initialize
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  });
  check("initialize 応答", init.result?.serverInfo?.name, init.result?.serverInfo?.name);
  notify("notifications/initialized", {});

  // 2. tools/list — _meta.ui.resourceUri が載っているか
  const tools = await rpc("tools/list", {});
  const hello = tools.result?.tools?.find((t) => t.name === "hello_board");
  check("hello_board tool 登録", hello, hello?.name);
  const uiUri = hello?._meta?.ui?.resourceUri;
  check(
    "_meta.ui.resourceUri 宣言",
    uiUri === "ui://hello/mcp-app.html",
    uiUri,
  );
  const marp = tools.result?.tools?.find((t) => t.name === "marp_board");
  check("marp_board tool 登録", marp, marp?.name);
  check(
    "marp_board _meta.ui 宣言",
    marp?._meta?.ui?.resourceUri === "ui://marp/marp-app.html",
    marp?._meta?.ui?.resourceUri,
  );

  // 3. resources/list — ui:// resource が見えるか
  const resources = await rpc("resources/list", {});
  const uiRes = resources.result?.resources?.find(
    (r) => r.uri === "ui://hello/mcp-app.html",
  );
  check("ui:// resource 登録", uiRes, uiRes?.uri);

  // 4. resources/read — bundle 済み HTML が返るか
  const read = await rpc("resources/read", { uri: "ui://hello/mcp-app.html" });
  const html = read.result?.contents?.[0]?.text ?? "";
  check("HTML 取得", html.length > 1000, `${html.length} bytes`);
  check("UI marker 含む", html.includes("Hello from an MCP App"));
  check("App bridge inline 済み", html.includes("connecting to host"));
  check("外部 script src なし", !/<script[^>]+src=["']https?:/.test(html));

  // marp resource も読めるか（marp-core が inline されているか）
  const marpRead = await rpc("resources/read", { uri: "ui://marp/marp-app.html" });
  const marpHtml = marpRead.result?.contents?.[0]?.text ?? "";
  check("marp HTML 取得", marpHtml.length > 1_000_000, `${marpHtml.length} bytes`);
  check("marp 外部 script src なし", !/<script[^>]+src=["']https?:/.test(marpHtml));

  // 5. tools/call — text 結果が返るか
  const call = await rpc("tools/call", { name: "hello_board", arguments: {} });
  const callText = call.result?.content?.find((c) => c.type === "text")?.text ?? "";
  check("hello_board 呼び出し", callText.includes("Hello from the MCP server"), callText);
} catch (e) {
  check("実行完了", false, String(e));
} finally {
  child.kill();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}
