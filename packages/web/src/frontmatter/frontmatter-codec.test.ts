/**
 * frontmatter-codec utility のテスト。
 *
 * 設計 doc 参照: 50_Mission/zddmission/MarpMaker/Atom-FrontmatterPanel.md
 */

import { describe, it, expect } from 'vitest'
import {
  extractFrontmatterValues,
  applyFrontmatterValues,
  type FrontmatterValues,
} from './frontmatter-codec'

const SAMPLE = `---
marp: true
theme: whitepaper-a4
size: A4
paginate: true
title: Sample Title
author: Aki
---

# Body

Content here.`

describe('extractFrontmatterValues', () => {
  it('returns empty object when no frontmatter', () => {
    const result = extractFrontmatterValues('# Just markdown\n\nContent.')
    expect(result).toEqual({})
  })

  it('extracts known fields from frontmatter', () => {
    const result = extractFrontmatterValues(SAMPLE)
    expect(result).toEqual({
      size: 'A4',
      paginate: true,
      title: 'Sample Title',
      author: 'Aki',
    } satisfies FrontmatterValues)
  })

  it('ignores unknown fields (marp / theme)', () => {
    const result = extractFrontmatterValues(SAMPLE)
    expect(result).not.toHaveProperty('marp')
    expect(result).not.toHaveProperty('theme')
  })

  it('handles boolean false', () => {
    const md = `---\nmarp: true\npaginate: false\n---\n# x`
    const result = extractFrontmatterValues(md)
    expect(result.paginate).toBe(false)
  })

  it('strips single quotes from quoted string', () => {
    const md = `---\nmarp: true\nfooter: 'Confidential: 2026'\n---\n# x`
    const result = extractFrontmatterValues(md)
    expect(result.footer).toBe('Confidential: 2026')
  })

  it('strips double quotes from quoted string', () => {
    const md = `---\nmarp: true\nheader: "with double quotes"\n---\n# x`
    const result = extractFrontmatterValues(md)
    expect(result.header).toBe('with double quotes')
  })

  it('rejects invalid size value', () => {
    const md = `---\nmarp: true\nsize: invalid-preset\n---\n# x`
    const result = extractFrontmatterValues(md)
    expect(result.size).toBeUndefined()
  })

  it('accepts all valid size presets', () => {
    for (const preset of ['A4', '16-9', '4-3', 'Letter']) {
      const md = `---\nmarp: true\nsize: ${preset}\n---\n# x`
      const result = extractFrontmatterValues(md)
      expect(result.size).toBe(preset)
    }
  })
})

describe('applyFrontmatterValues - existing frontmatter', () => {
  it('updates existing field value in place', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: 'New Title' })
    expect(updated).toContain('title: New Title')
    expect(updated).not.toContain('title: Sample Title')
    // 既存の marp / theme は touch されない
    expect(updated).toContain('marp: true')
    expect(updated).toContain('theme: whitepaper-a4')
  })

  it('adds new field at end of frontmatter when not previously present', () => {
    const updated = applyFrontmatterValues(SAMPLE, { footer: 'Page footer' })
    expect(updated).toContain('footer: Page footer')
    // 順序: 既存フィールドの後に新規追加
    const fmBlock = updated.match(/^---\n([\s\S]*?)\n---/)![1]!
    expect(fmBlock.split('\n').pop()).toContain('footer:')
  })

  it('removes existing field when value is undefined', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: undefined })
    expect(updated).not.toContain('Sample Title')
    expect(updated).not.toMatch(/^title:/m)
    // 他のフィールドは残る
    expect(updated).toContain('author: Aki')
  })

  it('preserves untouched fields (marp / theme / unknown)', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: 'X' })
    expect(updated).toContain('marp: true')
    expect(updated).toContain('theme: whitepaper-a4')
  })

  it('preserves body content after frontmatter', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: 'X' })
    expect(updated).toContain('# Body')
    expect(updated).toContain('Content here.')
  })

  it('quotes value containing special characters', () => {
    const updated = applyFrontmatterValues(SAMPLE, {
      footer: 'Confidential: 2026',
    })
    expect(updated).toContain("footer: 'Confidential: 2026'")
  })

  it('does not quote simple values', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: 'SimpleTitle' })
    expect(updated).toContain('title: SimpleTitle')
    expect(updated).not.toContain("'SimpleTitle'")
  })

  it('quotes empty string', () => {
    const updated = applyFrontmatterValues(SAMPLE, { title: '' })
    expect(updated).toContain("title: ''")
  })

  it('escapes embedded single quote', () => {
    const updated = applyFrontmatterValues(SAMPLE, {
      author: "Aki's name",
    })
    expect(updated).toContain("author: 'Aki''s name'")
  })

  it('writes boolean true/false unquoted', () => {
    const updated = applyFrontmatterValues(SAMPLE, { paginate: false })
    expect(updated).toContain('paginate: false')
    expect(updated).not.toContain("paginate: 'false'")
  })

  it('updates size preset', () => {
    const updated = applyFrontmatterValues(SAMPLE, { size: '16-9' })
    expect(updated).toContain('size: 16-9')
    expect(updated).not.toMatch(/size:\s*A4/)
  })
})

describe('applyFrontmatterValues - no existing frontmatter', () => {
  it('inserts frontmatter block at top when markdown has none', () => {
    const md = '# Just markdown\n\nContent.'
    const updated = applyFrontmatterValues(md, {
      title: 'New',
      size: 'A4',
    })
    expect(updated.startsWith('---\n')).toBe(true)
    expect(updated).toContain('size: A4')
    expect(updated).toContain('title: New')
    expect(updated).toContain('# Just markdown')
  })

  it('returns original markdown when no values to write and no frontmatter', () => {
    const md = '# Just markdown\n\nContent.'
    const updated = applyFrontmatterValues(md, {})
    expect(updated).toBe(md)
  })

  it('inserts only non-undefined fields', () => {
    const md = '# x'
    const updated = applyFrontmatterValues(md, {
      title: 'Only Title',
      author: undefined,
    })
    expect(updated).toContain('title: Only Title')
    expect(updated).not.toContain('author:')
  })
})

describe('applyFrontmatterValues - round trip', () => {
  it('extract then apply yields equivalent markdown', () => {
    const values = extractFrontmatterValues(SAMPLE)
    const reapplied = applyFrontmatterValues(SAMPLE, values)
    const reextracted = extractFrontmatterValues(reapplied)
    expect(reextracted).toEqual(values)
  })

  it('apply then extract returns same values', () => {
    const input: FrontmatterValues = {
      size: '16-9',
      title: 'Round Trip Title',
      author: 'Aki',
      paginate: true,
    }
    const md = applyFrontmatterValues('# body', input)
    const extracted = extractFrontmatterValues(md)
    expect(extracted).toEqual(input)
  })
})
