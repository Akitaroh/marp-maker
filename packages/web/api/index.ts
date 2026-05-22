/**
 * Vite middleware plugin で core を呼び出す API endpoint を提供。
 *
 * routes:
 * - POST /api/generate → Atom-AiGenerator (Claude API)
 * - POST /api/render   → Atom-MarpRenderer (HTML)
 * - POST /api/export   → Atom-MarpRenderer (PDF binary)
 *
 * 本番では Vercel Serverless Functions に置換予定 (MVP 後)。
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { Plugin, Connect } from 'vite'

import {
  generateMarp,
  renderMarp,
  loadTheme,
  type GenerateInput,
  type ThemeLoadInput,
} from '@akitaroh/marp-core'

// ===== types =====

/**
 * テーマ選択 (A1, 2026-05-22): バンドル / カスタム CSS 持込の 2 経路。
 * Web UI の Atom-ThemeSwitcher が選択結果を本型で API に送る。
 */
type ThemeSelection =
  | { kind: 'bundled'; themeId: string }
  | { kind: 'custom'; cssContent: string }

// ===== utils =====

async function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const buffer = Buffer.concat(chunks)
  if (buffer.length === 0) return {}
  return JSON.parse(buffer.toString('utf-8'))
}

/**
 * Theme を解決して tmp ファイル化、marp-cli に渡す絶対パスを返す。
 * - bundled: loadTheme({ themeId }) → tmp 書込
 * - custom:  loadTheme({ themeContent }) → tmp 書込（validate 含む）
 */
async function resolveThemePath(theme: ThemeSelection): Promise<string> {
  const input: ThemeLoadInput =
    theme.kind === 'bundled'
      ? { themeId: theme.themeId }
      : { themeContent: theme.cssContent }
  const themeData = await loadTheme(input)
  const idForFilename = theme.kind === 'bundled' ? theme.themeId : 'custom'
  const tmpPath = path.join(
    os.tmpdir(),
    `marp-maker-theme-${idForFilename}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.css`
  )
  await fs.writeFile(tmpPath, themeData.cssContent)
  return tmpPath
}

/**
 * 互換性 shim: 旧 body 形式 { themeId } と新形式 { theme: ThemeSelection } の両方を吸収。
 * 既存クライアントを壊さないため、themeId のみが渡された場合は bundled として扱う。
 */
function parseThemeFromBody(body: {
  theme?: ThemeSelection
  themeId?: string
}): ThemeSelection {
  if (body.theme) return body.theme
  if (body.themeId) return { kind: 'bundled', themeId: body.themeId }
  throw new Error('Request body must include "theme" or "themeId"')
}

function sendJson(
  res: Connect.ServerResponse,
  statusCode: number,
  body: unknown
): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function errorBody(e: unknown): {
  error: string
  kind?: string
  stderr?: string
  exitCode?: number | null
} {
  const err = e as {
    message?: string
    kind?: string
    stderr?: string
    exitCode?: number | null
  }
  return {
    error: err.message ?? 'Unknown error',
    kind: err.kind,
    stderr: err.stderr,
    exitCode: err.exitCode,
  }
}

// ===== plugin =====

export function apiPlugin(): Plugin {
  return {
    name: 'marp-maker-api',
    configureServer(server) {
      // POST /api/generate
      server.middlewares.use('/api/generate', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        try {
          const input = (await readJsonBody(req)) as GenerateInput
          const result = await generateMarp(input)
          sendJson(res, 200, result)
        } catch (e) {
          console.error('[api/generate] error:', e)
          sendJson(res, 500, errorBody(e))
        }
      })

      // POST /api/render (HTML)
      server.middlewares.use('/api/render', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        let themePath: string | null = null
        try {
          const body = (await readJsonBody(req)) as {
            markdown: string
            theme?: ThemeSelection
            themeId?: string  // legacy
          }
          themePath = await resolveThemePath(parseThemeFromBody(body))
          const result = await renderMarp({
            markdown: body.markdown,
            themePath,
            format: 'html',
          })
          if (result.format !== 'html') {
            sendJson(res, 500, { error: 'unexpected format' })
            return
          }
          sendJson(res, 200, { htmlString: result.htmlString })
        } catch (e) {
          console.error('[api/render] error:', e)
          sendJson(res, 500, errorBody(e))
        } finally {
          if (themePath) await fs.unlink(themePath).catch(() => undefined)
        }
      })

      // POST /api/export (PDF binary)
      server.middlewares.use('/api/export', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        let themePath: string | null = null
        let pdfPath: string | null = null
        try {
          const body = (await readJsonBody(req)) as {
            markdown: string
            theme?: ThemeSelection
            themeId?: string  // legacy
          }
          themePath = await resolveThemePath(parseThemeFromBody(body))
          const result = await renderMarp({
            markdown: body.markdown,
            themePath,
            format: 'pdf',
          })
          if (result.format !== 'pdf') {
            sendJson(res, 500, { error: 'unexpected format' })
            return
          }
          pdfPath = result.filePath
          const pdfBuffer = await fs.readFile(pdfPath)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Length', pdfBuffer.length.toString())
          res.end(pdfBuffer)
        } catch (e) {
          console.error('[api/export] error:', e)
          sendJson(res, 500, errorBody(e))
        } finally {
          if (themePath) await fs.unlink(themePath).catch(() => undefined)
          if (pdfPath) await fs.unlink(pdfPath).catch(() => undefined)
        }
      })
    },
  }
}
