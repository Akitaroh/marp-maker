/**
 * A3 / A2: Marp Passthrough Test スクリプト。
 * fixture を HTML + PDF にレンダして出力する。
 * 各機能が通るかは HTML 目視 + PDF 目視で確認する。
 *
 * 実行: node packages/core/test-fixtures/passthrough/run-passthrough.mjs
 *
 * 対象 fixture:
 * - all-features.md      — Page 単位の機能網羅（21 ページ）
 * - global-directives.md — Frontmatter の global directives 検証
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

// dist から import (build 前提)
const { renderMarp } = await import(
  path.join(repoRoot, 'packages/core/dist/marp/marp-renderer.js')
)
const { loadTheme } = await import(
  path.join(repoRoot, 'packages/core/dist/theme/theme-loader.js')
)

// theme をファイル化（renderMarp は themePath 要求）
const theme = await loadTheme({ themeId: 'whitepaper-a4' })
const themePath = path.join(__dirname, '_tmp-theme.css')
writeFileSync(themePath, theme.cssContent)

const fixtures = [
  { name: 'all-features', md: 'all-features.md' },
  { name: 'global-directives', md: 'global-directives.md' },
]

console.log('=== Marp Passthrough Test ===\n')

for (const fixture of fixtures) {
  console.log(`--- Fixture: ${fixture.name} ---`)
  const mdPath = path.join(__dirname, fixture.md)
  const markdown = readFileSync(mdPath, 'utf-8')

  // HTML render
  try {
    const htmlResult = await renderMarp({
      markdown,
      themePath,
      format: 'html',
    })
    if (htmlResult.format !== 'html') throw new Error('expected html')
    const htmlOutPath = path.join(__dirname, `_out-${fixture.name}.html`)
    writeFileSync(htmlOutPath, htmlResult.htmlString)
    console.log(`  HTML → ${htmlOutPath} (${htmlResult.htmlString.length} bytes)`)
  } catch (e) {
    console.error(`  HTML render failed:`, e.message)
    if (e.stderr) console.error('  stderr:', e.stderr)
  }

  // PDF render
  try {
    const pdfResult = await renderMarp({
      markdown,
      themePath,
      format: 'pdf',
    })
    if (pdfResult.format !== 'pdf') throw new Error('expected pdf')
    const pdfOutPath = path.join(__dirname, `_out-${fixture.name}.pdf`)
    copyFileSync(pdfResult.filePath, pdfOutPath)
    unlinkSync(pdfResult.filePath)
    console.log(`  PDF  → ${pdfOutPath}`)
  } catch (e) {
    console.error(`  PDF render failed:`, e.message)
    if (e.stderr) console.error('  stderr:', e.stderr)
  }

  console.log('')
}

// cleanup theme tmp
try {
  unlinkSync(themePath)
} catch {
  /* noop */
}

console.log('=== Done ===')
console.log('次: open packages/core/test-fixtures/passthrough/_out-all-features.pdf')
console.log('     open packages/core/test-fixtures/passthrough/_out-global-directives.pdf')
