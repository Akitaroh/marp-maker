/**
 * A3: Marp Passthrough Test スクリプト。
 * all-features.md を HTML + PDF にレンダして出力する。
 * 各機能が通るかは HTML 目視 + PDF 目視で確認する。
 *
 * 実行: node packages/core/test-fixtures/passthrough/run-passthrough.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
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

// fixture 読込
const mdPath = path.join(__dirname, 'all-features.md')
const markdown = readFileSync(mdPath, 'utf-8')

// theme をファイル化（renderMarp は themePath 要求）
const theme = await loadTheme({ themeId: 'whitepaper-a4' })
const themePath = path.join(__dirname, '_tmp-theme.css')
writeFileSync(themePath, theme.cssContent)

console.log('=== Marp Passthrough Test ===')
console.log(`fixture: ${mdPath}`)
console.log(`theme:   ${themePath}\n`)

// HTML render
console.log('Rendering HTML...')
try {
  const htmlResult = await renderMarp({
    markdown,
    themePath,
    format: 'html',
  })
  if (htmlResult.format !== 'html') throw new Error('expected html')
  const htmlOutPath = path.join(__dirname, '_out-all-features.html')
  writeFileSync(htmlOutPath, htmlResult.htmlString)
  console.log(`  → ${htmlOutPath} (${htmlResult.htmlString.length} bytes)`)
} catch (e) {
  console.error('  HTML render failed:', e.message)
  if (e.stderr) console.error('  stderr:', e.stderr)
}

// PDF render
console.log('\nRendering PDF...')
try {
  const pdfResult = await renderMarp({
    markdown,
    themePath,
    format: 'pdf',
  })
  if (pdfResult.format !== 'pdf') throw new Error('expected pdf')
  const pdfOutPath = path.join(__dirname, '_out-all-features.pdf')
  const { copyFileSync, unlinkSync } = await import('node:fs')
  copyFileSync(pdfResult.filePath, pdfOutPath)
  unlinkSync(pdfResult.filePath)
  console.log(`  → ${pdfOutPath}`)
} catch (e) {
  console.error('  PDF render failed:', e.message)
  if (e.stderr) console.error('  stderr:', e.stderr)
}

// cleanup
import('node:fs').then(({ unlinkSync }) => {
  try {
    unlinkSync(themePath)
  } catch {
    /* noop */
  }
})

console.log('\n=== Done ===')
console.log('次: open packages/core/test-fixtures/passthrough/_out-all-features.pdf')
