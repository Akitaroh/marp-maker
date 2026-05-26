/**
 * Atom-ObsidianCommandRegistry — Obsidian にコマンドを登録する Adapter。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianCommandRegistry.md
 *
 * Open Preview / PDF Export / 自己紹介 編集可 pptx Export の 3 コマンド。
 * AI 生成・視覚検証は呼び出し元 agent / MCP の仕事（plugin に AI を内蔵しない）。
 */
import { Plugin } from 'obsidian'

export interface CommandHandlers {
  onOpenPreview: () => void | Promise<void>
  onExport: () => void | Promise<void>
  /** profile（自己紹介）テンプレを編集可能 pptx で書き出す（pptxgenjs ネイティブ生成）*/
  onExportProfilePptx: () => void | Promise<void>
}

export function registerCommands(plugin: Plugin, handlers: CommandHandlers): void {
  plugin.addCommand({
    id: 'marp-maker-open-preview',
    name: 'Marp プレビューを開く',
    callback: () => void handlers.onOpenPreview(),
  })
  plugin.addCommand({
    id: 'marp-maker-export-pdf',
    name: 'PDF としてエクスポート',
    callback: () => void handlers.onExport(),
  })
  plugin.addCommand({
    id: 'marp-maker-export-profile-pptx',
    name: '自己紹介を編集可能 pptx で書き出す（profile）',
    callback: () => void handlers.onExportProfilePptx(),
  })
}
