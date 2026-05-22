/**
 * ZDD Atom: Atom-ThemeLoader のテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-ThemeLoader.md "検証経路" セクション
 */

import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

import { loadTheme, ThemeLoaderError } from './theme-loader'

// テスト用 CSS テンプレ
function validCss(themeName: string, sizeName: string, w: number, h: number): string {
  return `
/* @theme ${themeName} */
/* @size ${sizeName} ${w}px ${h}px */
section {
  width: ${w}px;
  height: ${h}px;
}
`
}

async function withTmpDir<T>(fn: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marp-maker-test-'))
  try {
    return await fn(tmpDir)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

describe('loadTheme - themeId (bundled)', () => {
  it('loads the bundled whitepaper-a4 theme', async () => {
    const theme = await loadTheme({ themeId: 'whitepaper-a4' })
    expect(theme.id).toBe('whitepaper-a4')
    expect(theme.size).toEqual({ name: 'A4', width: 793, height: 1122 })
    expect(theme.cssContent).toContain('@theme whitepaper-a4')
    expect(theme.cssContent).toContain('@size A4 793px 1122px')
  })

  it('loads the bundled slide-16-9 theme (A3)', async () => {
    const theme = await loadTheme({ themeId: 'slide-16-9' })
    expect(theme.id).toBe('slide-16-9')
    expect(theme.size).toEqual({ name: '16-9', width: 1280, height: 720 })
    expect(theme.cssContent).toContain('@theme slide-16-9')
  })

  it('loads the bundled minimal-mono theme (A3)', async () => {
    const theme = await loadTheme({ themeId: 'minimal-mono' })
    expect(theme.id).toBe('minimal-mono')
    expect(theme.size).toEqual({ name: 'A4', width: 793, height: 1122 })
    expect(theme.cssContent).toContain('@theme minimal-mono')
  })

  it('throws file-not-found for unknown themeId', async () => {
    try {
      await loadTheme({ themeId: 'no-such-theme-xyz' })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeLoaderError)
      expect((e as ThemeLoaderError).kind).toBe('file-not-found')
    }
  })
})

describe('loadTheme - themePath (external)', () => {
  it('loads theme from external absolute path', async () => {
    await withTmpDir(async (tmpDir) => {
      const themePath = path.join(tmpDir, 'custom.css')
      await fs.writeFile(themePath, validCss('custom-theme', 'Letter', 816, 1056))

      const theme = await loadTheme({ themePath })
      expect(theme.id).toBe('custom-theme')
      expect(theme.size).toEqual({ name: 'Letter', width: 816, height: 1056 })
    })
  })

  it('throws file-not-found for non-existent path', async () => {
    try {
      await loadTheme({ themePath: '/nonexistent/path/theme.css' })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeLoaderError)
      expect((e as ThemeLoaderError).kind).toBe('file-not-found')
    }
  })
})

describe('loadTheme - metadata parsing', () => {
  it('throws metadata-missing when @theme is absent', async () => {
    await withTmpDir(async (tmpDir) => {
      const themePath = path.join(tmpDir, 'no-theme.css')
      await fs.writeFile(themePath, `/* @size A4 793px 1122px */ section { width: 793px; }`)

      try {
        await loadTheme({ themePath })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ThemeLoaderError)
        expect((e as ThemeLoaderError).kind).toBe('metadata-missing')
      }
    })
  })

  it('throws metadata-missing when @size is absent', async () => {
    await withTmpDir(async (tmpDir) => {
      const themePath = path.join(tmpDir, 'no-size.css')
      await fs.writeFile(themePath, `/* @theme my-theme */ section { width: 793px; }`)

      try {
        await loadTheme({ themePath })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ThemeLoaderError)
        expect((e as ThemeLoaderError).kind).toBe('metadata-missing')
      }
    })
  })
})

describe('loadTheme - validation', () => {
  it('throws validation-failed for invalid id casing (uppercase)', async () => {
    await withTmpDir(async (tmpDir) => {
      const themePath = path.join(tmpDir, 'bad-id.css')
      await fs.writeFile(themePath, validCss('BadIdTheme', 'A4', 793, 1122))

      try {
        await loadTheme({ themePath })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ThemeLoaderError)
        expect((e as ThemeLoaderError).kind).toBe('validation-failed')
      }
    })
  })

  it('throws validation-failed for invalid id (special chars)', async () => {
    await withTmpDir(async (tmpDir) => {
      const themePath = path.join(tmpDir, 'bad-id2.css')
      // @theme regex は `[\w-]+` で _/英数字を許可するが、validator の kebab-case 規約で reject
      await fs.writeFile(themePath, validCss('theme_with_underscore', 'A4', 793, 1122))

      try {
        await loadTheme({ themePath })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ThemeLoaderError)
        expect((e as ThemeLoaderError).kind).toBe('validation-failed')
      }
    })
  })
})

describe('loadTheme - themeContent (A1, CSS string direct)', () => {
  it('loads theme from CSS content string without file I/O', async () => {
    const cssContent = validCss('inmemory-theme', 'A4', 793, 1122)
    const theme = await loadTheme({ themeContent: cssContent })
    expect(theme.id).toBe('inmemory-theme')
    expect(theme.size).toEqual({ name: 'A4', width: 793, height: 1122 })
    expect(theme.cssContent).toBe(cssContent)
  })

  it('parses size correctly for different page formats', async () => {
    const cssContent = validCss('slide-theme', 'sixteen-nine', 1280, 720)
    const theme = await loadTheme({ themeContent: cssContent })
    expect(theme.size).toEqual({ name: 'sixteen-nine', width: 1280, height: 720 })
  })

  it('throws metadata-missing for empty content', async () => {
    try {
      await loadTheme({ themeContent: '' })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeLoaderError)
      expect((e as ThemeLoaderError).kind).toBe('metadata-missing')
    }
  })

  it('throws metadata-missing when @theme is absent', async () => {
    const cssContent = `/* @size A4 793px 1122px */ section { width: 793px; }`
    try {
      await loadTheme({ themeContent: cssContent })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeLoaderError)
      expect((e as ThemeLoaderError).kind).toBe('metadata-missing')
    }
  })

  it('throws validation-failed for invalid theme id', async () => {
    const cssContent = validCss('BadCasing', 'A4', 793, 1122)
    try {
      await loadTheme({ themeContent: cssContent })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeLoaderError)
      expect((e as ThemeLoaderError).kind).toBe('validation-failed')
      expect((e as ThemeLoaderError).path).toBe('<in-memory>')
    }
  })
})
