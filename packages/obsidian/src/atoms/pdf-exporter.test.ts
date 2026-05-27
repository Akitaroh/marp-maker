import { describe, it, expect, vi } from 'vitest'
import { buildExportHtml, derivePath, exportDeck, parseSlideSize } from './pdf-exporter'

describe('derivePath', () => {
  it('md → pdf', () => expect(derivePath('a/b.md', 'pdf')).toBe('a/b.pdf'))
  it('md → html', () => expect(derivePath('deck.md', 'html')).toBe('deck.html'))
  it('拡張子なし → 付与', () => expect(derivePath('deck', 'pdf')).toBe('deck.pdf'))
})

describe('parseSlideSize', () => {
  it('viewBox から実寸を取る', () =>
    expect(parseSlideSize('<svg data-marpit-svg viewBox="0 0 1280 720">')).toEqual({ w: 1280, h: 720 }))
  it('viewBox 無しは A4 にフォールバック', () =>
    expect(parseSlideSize('<svg data-marpit-svg>')).toEqual({ w: 793, h: 1122 }))
})

describe('buildExportHtml', () => {
  it('css/html 埋込 + ページをスライド実寸(@page)に合わせる', () => {
    const out = buildExportHtml({ html: '<svg data-marpit-svg viewBox="0 0 1280 720"></svg>', css: '.x{color:red}' })
    expect(out).toContain('.x{color:red}')
    expect(out).toContain('data-marpit-svg')
    expect(out).toContain('size: 1280px 720px')
    expect(out).toContain('width:1280px;height:720px')
  })
  it('viewBox 無しは A4 実寸にフォールバック', () => {
    const out = buildExportHtml({ html: '<svg data-marpit-svg></svg>', css: 'body{}' })
    expect(out).toContain('size: 793px 1122px')
  })
})

describe('exportDeck', () => {
  it('Electron 不在（node 環境）では HTML にフォールバックする', async () => {
    const writeText = vi.fn(async (p: string) => ({ path: p }))
    const writeBinary = vi.fn()
    const deps = {
      renderMarp: () => ({ html: '<svg data-marpit-svg></svg>', css: 'body{}' }),
      vaultIO: {
        readMarkdown: vi.fn(),
        writeText,
        writeBinary,
      } as never,
    }
    const res = await exportDeck('# hi', 'deck.md', deps)
    expect(res.kind).toBe('html')
    expect(res.path).toBe('deck.html')
    expect(writeText).toHaveBeenCalled()
    expect(writeBinary).not.toHaveBeenCalled()
  })
})
