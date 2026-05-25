/**
 * Atom-ObsidianVaultIO — Vault ファイル読書きの薄い Adapter。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianVaultIO.md
 *
 * `.md` 読込（cachedRead 委譲）と export 先への書込（新規 create / 既存 modify を吸収）。
 * preview-view は cachedRead を直接使う（Bond-PreviewViewReadsVault は任意）。
 * export（pdf-exporter）が書込側でこの Atom を使う。
 */
import { normalizePath } from 'obsidian'
import type { TFile, Vault } from 'obsidian'

export interface VaultIO {
  /** Markdown 本文を読む（cachedRead = 最後の保存内容） */
  readMarkdown(file: TFile): Promise<string>
  /** テキストファイルを書く（存在すれば上書き、なければ新規作成） */
  writeText(path: string, text: string): Promise<TFile>
  /** バイナリ（PDF 等）を書く（存在すれば上書き、なければ新規作成） */
  writeBinary(path: string, data: ArrayBuffer): Promise<TFile>
}

export function createVaultIO(vault: Vault): VaultIO {
  const resolveExisting = (path: string): TFile | null => {
    const af = vault.getAbstractFileByPath(normalizePath(path))
    // duck-typed: TFile は stat/extension を持つ。folder と区別するため extension で判定。
    return af && 'extension' in af ? (af as TFile) : null
  }

  return {
    readMarkdown(file: TFile): Promise<string> {
      return vault.cachedRead(file)
    },

    async writeText(path: string, text: string): Promise<TFile> {
      const normalized = normalizePath(path)
      const existing = resolveExisting(normalized)
      if (existing) {
        await vault.modify(existing, text)
        return existing
      }
      return vault.create(normalized, text)
    },

    async writeBinary(path: string, data: ArrayBuffer): Promise<TFile> {
      const normalized = normalizePath(path)
      const existing = resolveExisting(normalized)
      if (existing) {
        await vault.modifyBinary(existing, data)
        return existing
      }
      return vault.createBinary(normalized, data)
    },
  }
}
