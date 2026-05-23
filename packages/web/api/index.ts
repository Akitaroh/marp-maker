/**
 * Vite middleware plugin で core を呼び出す API endpoint を提供。
 *
 * routes:
 * - POST /api/generate → Atom-AiGenerator (Claude API)
 * - POST /api/render   → Atom-MarpRenderer (HTML)
 * - POST /api/export   → Atom-MarpRenderer (PDF / PPTX / PNG binary)
 *
 * A5 (2026-05-22): /api/export を format 動的選択（pdf / pptx / png）に拡張。
 * PPTX は LibreOffice headless 依存（deploy 環境注意）。
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
      // dogfood-fix 1 (2026-05-23): body.template で bespoke / bare 切替対応
      server.middlewares.use('/api/render', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        let themePath: string | null = null
        try {
          const body = (await readJsonBody(req)) as {
            markdown: string
            theme?: ThemeSelection
            themeId?: string  // legacy
            template?: 'bespoke' | 'bare'
          }
          themePath = await resolveThemePath(parseThemeFromBody(body))
          const result = await renderMarp({
            markdown: body.markdown,
            themePath,
            format: 'html',
            template: body.template,
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

      // POST /api/export (PDF / PPTX / PNG binary)
      // A5 で拡張: body.format で動的選択。後方互換: format 未指定なら pdf
      server.middlewares.use('/api/export', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        let themePath: string | null = null
        let outputPath: string | null = null
        try {
          const body = (await readJsonBody(req)) as {
            markdown: string
            theme?: ThemeSelection
            themeId?: string  // legacy
            format?: 'pdf' | 'pptx' | 'png'
            pdf?: { outlines?: boolean; notes?: boolean }
          }
          themePath = await resolveThemePath(parseThemeFromBody(body))
          const format = body.format ?? 'pdf'

          if (format === 'pdf') {
            const result = await renderMarp({
              markdown: body.markdown,
              themePath,
              format: 'pdf',
              outlines: body.pdf?.outlines,
              notes: body.pdf?.notes,
            })
            if (result.format !== 'pdf') {
              sendJson(res, 500, { error: 'unexpected format' })
              return
            }
            outputPath = result.filePath
            const buf = await fs.readFile(outputPath)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Length', buf.length.toString())
            res.end(buf)
          } else if (format === 'pptx') {
            const result = await renderMarp({
              markdown: body.markdown,
              themePath,
              format: 'pptx',
            })
            if (result.format !== 'pptx') {
              sendJson(res, 500, { error: 'unexpected format' })
              return
            }
            outputPath = result.filePath
            const buf = await fs.readFile(outputPath)
            res.statusCode = 200
            res.setHeader(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            )
            res.setHeader('Content-Length', buf.length.toString())
            res.end(buf)
          } else if (format === 'png') {
            // PNG: 全ページ分の Buffer 配列。ここでは ZIP 圧縮して 1 ファイル化する設計もあるが、
            // MVP の A5 では 1 ページ目のみ返す（簡易）。複数ページ対応は後段で。
            const result = await renderMarp({
              markdown: body.markdown,
              themePath,
              format: 'png',
            })
            if (result.format !== 'png') {
              sendJson(res, 500, { error: 'unexpected format' })
              return
            }
            const first = result.pngBuffers[0]
            if (!first) {
              sendJson(res, 500, { error: 'no PNG generated' })
              return
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Content-Length', first.length.toString())
            res.end(first)
          } else {
            sendJson(res, 400, { error: `Unknown format: ${String(format)}` })
            return
          }
        } catch (e) {
          console.error('[api/export] error:', e)
          sendJson(res, 500, errorBody(e))
        } finally {
          if (themePath) await fs.unlink(themePath).catch(() => undefined)
          if (outputPath) await fs.unlink(outputPath).catch(() => undefined)
        }
      })
    },
  }
}
