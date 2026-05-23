/**
 * ZDD Atom: Atom-MarpRenderer のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-MarpRenderer.md "検証経路" セクション
 *
 * 注: marp-cli を実際に起動する統合テストは時間がかかる（数秒〜数十秒）。
 * `RUN_INTEGRATION=1` 環境変数のときのみ実行する。
 *
 * 通常の単体テストはエラーケース中心（テーマ未存在、入力バリデーション）。
 */

import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

import { renderMarp, RenderError } from './marp-renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_THEME = path.resolve(__dirname, '../../themes/whitepaper-a4.css')

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1'

const simpleMarkdown = `---
marp: true
theme: whitepaper-a4
size: A4
---

# テストタイトル

これは MarpRenderer の統合テスト。

---

## ページ 2

- 項目 1
- 項目 2
- 項目 3
`

// ===== 単体テスト（高速、常時実行）=====

describe('renderMarp - error cases (unit)', () => {
  it('throws theme-not-found when themePath does not exist', async () => {
    try {
      await renderMarp({
        markdown: '# Test',
        themePath: '/no/such/theme.css',
        format: 'html',
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RenderError)
      expect((e as RenderError).kind).toBe('theme-not-found')
    }
  })
})

// ===== 統合テスト（marp-cli 実起動、RUN_INTEGRATION=1 のみ）=====

describe.skipIf(!RUN_INTEGRATION)('renderMarp - integration (marp-cli)', () => {
  it('renders HTML from simple markdown (default = bespoke template)', async () => {
    const result = await renderMarp({
      markdown: simpleMarkdown,
      themePath: BUNDLED_THEME,
      format: 'html',
    })

    expect(result.format).toBe('html')
    if (result.format === 'html') {
      expect(result.htmlString.length).toBeGreaterThan(0)
      // HTML に主要なテキストが含まれる
      expect(result.htmlString).toContain('テストタイトル')
      // テーマ CSS が反映されている兆候
      expect(result.htmlString).toMatch(/whitepaper-a4|<style>/i)
      // dogfood-fix 1: default は bespoke template (bespoke-marp class が出る)
      expect(result.htmlString).toContain('bespoke-marp')
    }
  }, 90_000)

  it('renders HTML with bare template (dogfood-fix 1)', async () => {
    const result = await renderMarp({
      markdown: simpleMarkdown,
      themePath: BUNDLED_THEME,
      format: 'html',
      template: 'bare',
    })

    expect(result.format).toBe('html')
    if (result.format === 'html') {
      // bare template では bespoke の JS / class は出ない
      expect(result.htmlString).not.toContain('bespoke-marp')
      // 各 section が body 直下に並ぶ（複数 page = 2 section）
      const sectionCount = (result.htmlString.match(/<section/g) || []).length
      expect(sectionCount).toBeGreaterThanOrEqual(2)
      // テキストは含まれる
      expect(result.htmlString).toContain('テストタイトル')
      expect(result.htmlString).toContain('ページ 2')
    }
  }, 90_000)

  it('renders PNG (multiple pages)', async () => {
    const result = await renderMarp({
      markdown: simpleMarkdown,
      themePath: BUNDLED_THEME,
      format: 'png',
    })

    expect(result.format).toBe('png')
    if (result.format === 'png') {
      // simpleMarkdown は frontmatter + 2 ページ → 区切り `---` が 3 個 = 2 ページレンダ
      expect(result.pngBuffers.length).toBeGreaterThanOrEqual(2)
      // 各 buffer が PNG マジックナンバーで始まる
      for (const buf of result.pngBuffers) {
        expect(buf.byteLength).toBeGreaterThan(0)
        expect(buf[0]).toBe(0x89)
        expect(buf[1]).toBe(0x50) // P
      }
    }
  }, 120_000)

  it('renders PNG with pageRange filter', async () => {
    const result = await renderMarp({
      markdown: simpleMarkdown,
      themePath: BUNDLED_THEME,
      format: 'png',
      pageRange: [1, 1],
    })

    expect(result.format).toBe('png')
    if (result.format === 'png') {
      expect(result.pngBuffers.length).toBe(1)
    }
  }, 120_000)

  it('renders PDF and returns a stable filePath', async () => {
    const result = await renderMarp({
      markdown: simpleMarkdown,
      themePath: BUNDLED_THEME,
      format: 'pdf',
    })

    expect(result.format).toBe('pdf')
    if (result.format === 'pdf') {
      // ファイルが存在する
      const stat = await fs.stat(result.filePath)
      expect(stat.isFile()).toBe(true)
      expect(stat.size).toBeGreaterThan(0)

      // PDF マジックナンバー
      const buf = await fs.readFile(result.filePath)
      expect(buf.slice(0, 4).toString()).toBe('%PDF')

      // 呼出側で削除
      await fs.unlink(result.filePath)
    }
  }, 120_000)
})

// ===== 単体テスト（page count, build args 等の内部ロジック）=====
// 内部関数を直接 export していないため、renderMarp の振る舞いから間接的に検証。
// 純粋ロジックの境界条件は統合テスト + コードレビューでカバーする方針。
