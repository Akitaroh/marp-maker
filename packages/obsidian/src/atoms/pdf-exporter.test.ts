import { describe, it, expect, vi } from 'vitest'
import { buildExportHtml, derivePath, exportDeck } from './pdf-exporter'

describe('derivePath', () => {
  it('md → pdf', () => expect(derivePath('a/b.md', 'pdf')).toBe('a/b.pdf'))
  it('md → html', () => expect(derivePath('deck.md', 'html')).toBe('deck.html'))
  it('拡張子なし → 付与', () => expect(derivePath('deck', 'pdf')).toBe('deck.pdf'))
})

describe('buildExportHtml', () => {
  it('css と html を埋め込み A4 印刷指定を含む', () => {
    const out = buildExportHtml({ html: '<svg data-marpit-svg></svg>', css: '.x{color:red}' })
    expect(out).toContain('.x{color:red}')
    expect(out).toContain('data-marpit-svg')
    expect(out).toContain('size: A4')
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
