/**
 * show_marp board の stdio smoke test（ビルド済み dist/bin.js を実起動）。
 * initialize → tools/list(show_marp + _meta.ui) → resources/read(board) → tools/call(show_marp)
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const binPath = path.join(here, '..', 'dist', 'bin.js')

const child = spawn('node', [binPath], { stdio: ['pipe', 'pipe', 'inherit'] })

let buf = ''
const pending = new Map()
child.stdout.on('data', (chunk) => {
  buf += chunk.toString()
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

let nextId = 1
function rpc(method, params) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`timeout: ${method}`))
      }
    }, 10000)
  })
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

const checks = []
function check(name, cond, detail) {
  checks.push(!!cond)
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'board-smoke', version: '0' },
  })
  check('initialize', init.result?.serverInfo?.name, init.result?.serverInfo?.name)
  notify('notifications/initialized', {})

  const tools = await rpc('tools/list', {})
  const names = (tools.result?.tools ?? []).map((t) => t.name)
  check('既存 4 tool 健在', ['generate_marp', 'render_marp', 'detect_issues', 'suggest_fix'].every((n) => names.includes(n)), names.join(','))
  const show = tools.result?.tools?.find((t) => t.name === 'show_marp')
  check('show_marp 登録', show, show?.name)
  check('show_marp _meta.ui 宣言', show?._meta?.ui?.resourceUri === 'ui://marp/board.html', show?._meta?.ui?.resourceUri)

  const resources = await rpc('resources/list', {})
  const board = resources.result?.resources?.find((r) => r.uri === 'ui://marp/board.html')
  check('board resource 登録', board, board?.uri)

  const read = await rpc('resources/read', { uri: 'ui://marp/board.html' })
  const html = read.result?.contents?.[0]?.text ?? ''
  check('board HTML 取得（marp-core inline）', html.length > 1_000_000, `${html.length} bytes`)
  check('board 外部 script src なし', !/<script[^>]+src=["']https?:/.test(html))

  const call = await rpc('tools/call', { name: 'show_marp', arguments: { markdown: '# Hi\n\n---\n\n# Page2' } })
  const text = call.result?.content?.find((c) => c.type === 'text')?.text ?? ''
  check('show_marp 呼び出し（markdown 返却）', text.includes('Page2'), text.slice(0, 40))
} catch (e) {
  check('実行完了', false, String(e))
} finally {
  child.kill()
  const failed = checks.filter((c) => !c).length
  console.log(`\n${checks.length - failed}/${checks.length} passed`)
  process.exit(failed === 0 ? 0 : 1)
}
