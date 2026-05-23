/**
 * marp-mcp dogfood smoke test
 *
 * Real JSON-RPC over stdio against the built bin.js. Verifies:
 *   1. MCP handshake (initialize + initialized)
 *   2. tools/list returns 4 expected tool names
 *   3. tools/call render_marp -> html (no API key required, local marp-cli)
 *   4. tools/call render_marp -> pdf (local marp-cli + Chrome Headless)
 *
 * Run from anywhere (uses absolute paths):
 *   node packages/mcp/scripts/dogfood-smoke.mjs
 *
 * Why this exists: unit tests use a mock McpServer to invoke handlers directly.
 * This script exercises the *real* MCP transport (stdio + JSON-RPC framing) to
 * catch protocol-level regressions that mocks can hide.
 */

import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// packages/mcp/scripts/ から見て ../dist/bin.js
const BIN = resolve(__dirname, '..', 'dist', 'bin.js')
// packages/mcp/scripts/ から見て ../../core/themes/whitepaper-a4.css
const THEME = resolve(__dirname, '..', '..', 'core', 'themes', 'whitepaper-a4.css')

if (!existsSync(BIN)) {
  console.error('[dogfood] bin.js not found at', BIN)
  console.error('  Run: pnpm --filter @akitaroh/marp-mcp build')
  process.exit(1)
}
if (!existsSync(THEME)) {
  console.error('[dogfood] theme not found at', THEME)
  process.exit(1)
}

const proc = spawn('node', [BIN], { stdio: ['pipe', 'pipe', 'inherit'] })

let buffer = ''
let messageId = 0
const pending = new Map()

proc.stdout.on('data', (chunk) => {
  buffer += chunk.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop()
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id).resolve(msg)
        pending.delete(msg.id)
      }
    } catch {
      console.error('[dogfood] parse fail:', line.substring(0, 200))
    }
  }
})

function send(method, params) {
  const id = ++messageId
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  proc.stdin.write(msg + '\n')
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.get(id).reject(new Error(`timeout: ${method}`))
        pending.delete(id)
      }
    }, 60_000)
  })
}

function notify(method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params })
  proc.stdin.write(msg + '\n')
}

async function main() {
  console.log('[dogfood] === 1. initialize ===')
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'marp-mcp-dogfood', version: '0.0.0' },
  })
  console.log('  serverInfo:', init.result?.serverInfo)
  console.log('  capabilities.tools:', !!init.result?.capabilities?.tools)

  notify('notifications/initialized', {})

  console.log('\n[dogfood] === 2. tools/list ===')
  const tools = await send('tools/list', {})
  const names = tools.result?.tools?.map((t) => t.name).sort()
  console.log('  tool names:', names)
  const expected = ['detect_issues', 'generate_marp', 'render_marp', 'suggest_fix']
  const ok = JSON.stringify(names) === JSON.stringify(expected)
  console.log('  expected 4 tools matched:', ok ? 'YES ✓' : 'NO ✗')

  console.log('\n[dogfood] === 3. render_marp (html, no API key needed) ===')
  const renderHtml = await send('tools/call', {
    name: 'render_marp',
    arguments: {
      markdown: [
        '---',
        'marp: true',
        'theme: whitepaper-a4',
        '---',
        '# MCP smoke test',
        '',
        'Hello from Claude Code via @akitaroh/marp-mcp.',
        '',
        '---',
        '',
        '## Page 2',
        '',
        '- bullet 1',
        '- bullet 2',
      ].join('\n'),
      themePath: THEME,
      format: 'html',
    },
  })
  if (renderHtml.result?.isError) {
    console.log('  ✗ error:', renderHtml.result.content?.[0]?.text?.substring(0, 300))
  } else {
    const text = renderHtml.result?.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    const htmlLen = parsed.htmlString?.length ?? 0
    console.log('  ✓ html generated:', htmlLen, 'chars, contains <section>:', parsed.htmlString?.includes('<section'))
  }

  console.log('\n[dogfood] === 4. render_marp (pdf, marp-cli + Chrome) ===')
  console.log('  (this may take 5-10s for Chrome startup...)')
  const renderPdf = await send('tools/call', {
    name: 'render_marp',
    arguments: {
      markdown: [
        '---',
        'marp: true',
        'theme: whitepaper-a4',
        '---',
        '# MCP PDF smoke test',
        '',
        'Generated via render_marp tool over stdio.',
      ].join('\n'),
      themePath: THEME,
      format: 'pdf',
    },
  })
  if (renderPdf.result?.isError) {
    console.log('  ✗ error:', renderPdf.result.content?.[0]?.text?.substring(0, 300))
  } else {
    const text = renderPdf.result?.content?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    console.log('  ✓ pdf generated at:', parsed.filePath)
    if (parsed.filePath && existsSync(parsed.filePath)) {
      console.log('  ✓ file exists, size:', statSync(parsed.filePath).size, 'bytes')
    }
  }

  console.log('\n[dogfood] === 5. shutdown ===')
  proc.kill('SIGTERM')
  setTimeout(() => process.exit(0), 500)
}

main().catch((err) => {
  console.error('[dogfood] FAILED:', err.message)
  proc.kill('SIGTERM')
  process.exit(1)
})
