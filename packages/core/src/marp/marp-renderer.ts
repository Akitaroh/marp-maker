/**
 * ZDD Atom: Atom-MarpRenderer (Logic Adapter)
 * marp-cli を子プロセスで起動し、Marp Markdown を HTML/PDF/PNG にレンダする。
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-MarpRenderer.md
 *
 * - 入力: RenderInput (discriminated union)
 * - 出力: RenderOutput (discriminated union)
 * - 副作用: 一時ディレクトリ作成、子プロセス起動、ファイル I/O
 *
 * NOTE (実装で判明した知見): PDF は呼出側 cleanup を強制しない設計に変更。
 * 内部一時ディレクトリは即削除し、PDF は OS tmpdir に独立コピー (filePath で返す)。
 * 呼出側がコピー後に削除する責任を持つ標準的な「一時ファイル提供」パターン。
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// @marp-team/marp-cli の bin (marp) の絶対パスを resolve。
// `npx @marp-team/marp-cli` だと bin 解決が PATH 依存で限定環境（Vite middleware）で失敗するため、
// node + bin の JS ファイルを直接 spawn する。
const require = createRequire(import.meta.url)
let _marpBinPath: string | null = null

function resolveMarpBin(): string {
  if (_marpBinPath != null) return _marpBinPath
  const cliPkgJsonPath = require.resolve('@marp-team/marp-cli/package.json')
  const cliPkg = require('@marp-team/marp-cli/package.json') as {
    bin: string | Record<string, string>
  }
  const marpBinRel =
    typeof cliPkg.bin === 'string' ? cliPkg.bin : cliPkg.bin.marp
  if (!marpBinRel) {
    throw new Error('Failed to resolve marp bin from @marp-team/marp-cli')
  }
  _marpBinPath = path.resolve(path.dirname(cliPkgJsonPath), marpBinRel)
  return _marpBinPath
}

// Marp 設定ファイル (math / html / engine plugin 等) の絶対パスを resolve。
// `packages/core/marp.config.mjs` を `--config` で marp-cli に渡す。
// mjs を使う理由: engine プラグイン (markdown-it-task-lists / footnote) を import して
// 関数形式で渡すため、JSON では表現不可。
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MARP_CONFIG_PATH = path.resolve(__dirname, '../../marp.config.mjs')

// ===== 入力型 (discriminated union) =====

export type RenderInput =
  | { markdown: string; themePath: string; format: 'html' }
  | {
      markdown: string
      themePath: string
      format: 'pdf'
      outlines?: boolean
    }
  | {
      markdown: string
      themePath: string
      format: 'png'
      pageRange?: [number, number]
    }

// ===== 出力型 (discriminated union) =====

export type RenderOutput =
  | { format: 'html'; htmlString: string }
  | { format: 'pdf'; filePath: string }
  | { format: 'png'; pngBuffers: Buffer[] }

// ===== エラー型 =====

export type RenderErrorKind =
  | 'cli-not-found'
  | 'chrome-not-found'
  | 'theme-not-found'
  | 'render-failed'
  | 'timeout'

interface RenderErrorOpts {
  kind: RenderErrorKind
  stderr?: string
  exitCode?: number | null
  message?: string
}

export class RenderError extends Error {
  readonly kind: RenderErrorKind
  readonly stderr?: string
  readonly exitCode?: number | null

  constructor(opts: RenderErrorOpts) {
    super(
      opts.message ??
        `[${opts.kind}]${opts.exitCode != null ? ` (exit ${opts.exitCode})` : ''}`
    )
    this.name = 'RenderError'
    this.kind = opts.kind
    this.stderr = opts.stderr
    this.exitCode = opts.exitCode
  }
}

// ===== 内部定数 =====

const BASE_TIMEOUT_MS = 60_000
const TIMEOUT_PER_10_PAGES_MS = 10_000
const MAX_TIMEOUT_MS = 300_000

// ===== 内部ロジック =====

function countPages(markdown: string): number {
  const matches = markdown.match(/^---\s*$/gm)
  if (!matches) return 1
  return Math.max(matches.length, 1)
}

function calcTimeout(markdown: string): number {
  const pages = countPages(markdown)
  const extra = Math.floor(pages / 10) * TIMEOUT_PER_10_PAGES_MS
  return Math.min(BASE_TIMEOUT_MS + extra, MAX_TIMEOUT_MS)
}

function buildArgs(
  input: RenderInput,
  mdPath: string,
  themePath: string,
  outPath: string
): string[] {
  // --config: marp.config.json で math/html を有効化（A3.1 で追加）
  const common = [
    mdPath,
    '--config',
    MARP_CONFIG_PATH,
    '--theme',
    themePath,
    '--allow-local-files',
  ]
  switch (input.format) {
    case 'html':
      return [...common, '-o', outPath]
    case 'pdf':
      return [
        ...common,
        '--pdf',
        ...(input.outlines ? ['--pdf-outlines'] : []),
        '-o',
        outPath,
      ]
    case 'png':
      return [...common, '--images', 'png']
  }
}

interface ProcessResult {
  exitCode: number | null
  stderr: string
}

function runMarpCli(
  args: string[],
  timeoutMs: number
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    // node で marp.js を直接実行 (bin 解決を回避)
    let marpBin: string
    try {
      marpBin = resolveMarpBin()
    } catch (e) {
      reject(
        new RenderError({
          kind: 'cli-not-found',
          message: (e as Error).message,
        })
      )
      return
    }
    const child = spawn(process.execPath, [marpBin, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    let timedOut = false

    child.stdout?.on('data', () => {
      // marp-cli の stdout は通常 INFO レベルのログ、本実装では不要
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new RenderError({ kind: 'timeout', stderr }))
        return
      }
      resolve({ exitCode, stderr })
    })
  })
}

function classifyError(result: ProcessResult): RenderError {
  const stderr = result.stderr.toLowerCase()
  if (
    stderr.includes('chrome') ||
    stderr.includes('chromium') ||
    stderr.includes('puppeteer') ||
    stderr.includes('browser')
  ) {
    return new RenderError({
      kind: 'chrome-not-found',
      stderr: result.stderr,
      exitCode: result.exitCode,
    })
  }
  if (stderr.includes('theme') && stderr.includes('not found')) {
    return new RenderError({
      kind: 'theme-not-found',
      stderr: result.stderr,
      exitCode: result.exitCode,
    })
  }
  return new RenderError({
    kind: 'render-failed',
    stderr: result.stderr,
    exitCode: result.exitCode,
  })
}

async function readPngOutputs(
  tmpDir: string,
  pageRange?: [number, number]
): Promise<Buffer[]> {
  const files = await fs.readdir(tmpDir)
  const pngFiles = files.filter((f) => /^slide\.\d{3}\.png$/.test(f)).sort()
  let buffers: Buffer[] = await Promise.all(
    pngFiles.map((f) => fs.readFile(path.join(tmpDir, f)))
  )
  if (pageRange) {
    const [start, end] = pageRange
    buffers = buffers.slice(start - 1, end)
  }
  return buffers
}

async function copyPdfToStablePath(tmpDir: string): Promise<string> {
  const src = path.join(tmpDir, 'out.pdf')
  const dest = path.join(
    os.tmpdir(),
    `marp-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  )
  const buffer = await fs.readFile(src)
  await fs.writeFile(dest, buffer)
  return dest
}

// ===== 公開 API =====

/**
 * Marp Markdown を HTML/PDF/PNG にレンダする。
 *
 * 内部で marp-cli (npx) を子プロセス起動し、一時ディレクトリで作業する。
 * 成功時は format に応じた RenderOutput を返し、内部一時ディレクトリは削除する。
 * PDF の場合は OS tmpdir に独立 path をコピーし、呼出側がパスを保持して使用後に削除する。
 */
export async function renderMarp(input: RenderInput): Promise<RenderOutput> {
  // theme path 事前確認
  try {
    await fs.access(input.themePath)
  } catch {
    throw new RenderError({
      kind: 'theme-not-found',
      message: `Theme file not found: ${input.themePath}`,
    })
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marp-maker-'))
  const mdPath = path.join(tmpDir, 'slide.md')
  const themePath = path.join(tmpDir, 'theme.css')
  const outExt = input.format === 'png' ? 'png' : input.format
  const outPath = path.join(tmpDir, `out.${outExt}`)

  try {
    const themeContent = await fs.readFile(input.themePath, 'utf-8')
    await fs.writeFile(mdPath, input.markdown, 'utf-8')
    await fs.writeFile(themePath, themeContent, 'utf-8')

    const args = buildArgs(input, mdPath, themePath, outPath)
    const timeoutMs = calcTimeout(input.markdown)

    let result: ProcessResult
    try {
      result = await runMarpCli(args, timeoutMs)
    } catch (e) {
      if (e instanceof RenderError) throw e
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        throw new RenderError({
          kind: 'cli-not-found',
          message: 'marp-cli (via npx) not available',
          stderr: err.message,
        })
      }
      throw new RenderError({
        kind: 'render-failed',
        message: err.message,
      })
    }

    if (result.exitCode !== 0) {
      throw classifyError(result)
    }

    switch (input.format) {
      case 'html': {
        const htmlString = await fs.readFile(outPath, 'utf-8')
        return { format: 'html', htmlString }
      }
      case 'pdf': {
        const filePath = await copyPdfToStablePath(tmpDir)
        return { format: 'pdf', filePath }
      }
      case 'png': {
        const pngBuffers = await readPngOutputs(tmpDir, input.pageRange)
        return { format: 'png', pngBuffers }
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {
      // cleanup 失敗は無視（呼出側にエラーを伝えない）
    })
  }
}
