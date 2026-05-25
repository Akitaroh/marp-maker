import { describe, it, expect, vi } from 'vitest'
import { createVaultIO } from './vault-io'

interface FakeFile {
  path: string
  extension: string
  _content?: string
  _data?: ArrayBuffer
}

function fakeVault(seed: Record<string, FakeFile> = {}) {
  const store: Record<string, FakeFile> = { ...seed }
  return {
    store,
    getAbstractFileByPath: vi.fn((p: string) => store[p] ?? null),
    cachedRead: vi.fn(async (f: FakeFile) => f._content ?? ''),
    create: vi.fn(async (p: string, text: string) => {
      const f: FakeFile = { path: p, extension: p.split('.').pop() ?? '', _content: text }
      store[p] = f
      return f
    }),
    modify: vi.fn(async (f: FakeFile, text: string) => {
      f._content = text
    }),
    createBinary: vi.fn(async (p: string, data: ArrayBuffer) => {
      const f: FakeFile = { path: p, extension: p.split('.').pop() ?? '', _data: data }
      store[p] = f
      return f
    }),
    modifyBinary: vi.fn(async (f: FakeFile, data: ArrayBuffer) => {
      f._data = data
    }),
  }
}

describe('createVaultIO', () => {
  it('readMarkdown は cachedRead に委譲する', async () => {
    const v = fakeVault()
    const io = createVaultIO(v as never)
    const file = { _content: 'hello' } as never
    expect(await io.readMarkdown(file)).toBe('hello')
    expect(v.cachedRead).toHaveBeenCalledWith(file)
  })

  it('writeText: 存在しなければ create', async () => {
    const v = fakeVault()
    const io = createVaultIO(v as never)
    const f = await io.writeText('out.html', '<html>')
    expect(v.create).toHaveBeenCalled()
    expect(v.modify).not.toHaveBeenCalled()
    expect(f.path).toBe('out.html')
  })

  it('writeText: 存在すれば modify（上書き）', async () => {
    const v = fakeVault({
      'out.html': { path: 'out.html', extension: 'html', _content: 'old' },
    })
    const io = createVaultIO(v as never)
    await io.writeText('out.html', 'new')
    expect(v.modify).toHaveBeenCalled()
    expect(v.create).not.toHaveBeenCalled()
  })

  it('writeBinary: 存在しなければ createBinary', async () => {
    const v = fakeVault()
    const io = createVaultIO(v as never)
    await io.writeBinary('out.pdf', new ArrayBuffer(8))
    expect(v.createBinary).toHaveBeenCalled()
    expect(v.modifyBinary).not.toHaveBeenCalled()
  })

  it('writeBinary: 存在すれば modifyBinary', async () => {
    const v = fakeVault({
      'out.pdf': { path: 'out.pdf', extension: 'pdf', _data: new ArrayBuffer(0) },
    })
    const io = createVaultIO(v as never)
    await io.writeBinary('out.pdf', new ArrayBuffer(8))
    expect(v.modifyBinary).toHaveBeenCalled()
    expect(v.createBinary).not.toHaveBeenCalled()
  })

  it('readCssInFolder: フォルダ内の .css だけ読む', async () => {
    const folder = {
      children: [
        { extension: 'css', _content: '/* @theme a */' },
        { extension: 'css', _content: '/* @theme b */' },
        { extension: 'md', _content: '# not css' },
      ],
    }
    const v = fakeVault({ 'marp-themes': folder as unknown as FakeFile })
    const io = createVaultIO(v as never)
    const cssList = await io.readCssInFolder('marp-themes')
    expect(cssList).toEqual(['/* @theme a */', '/* @theme b */'])
  })

  it('readCssInFolder: 空パスは []', async () => {
    const io = createVaultIO(fakeVault() as never)
    expect(await io.readCssInFolder('')).toEqual([])
  })

  it('readCssInFolder: フォルダが無ければ []', async () => {
    const io = createVaultIO(fakeVault() as never)
    expect(await io.readCssInFolder('nope')).toEqual([])
  })
})
