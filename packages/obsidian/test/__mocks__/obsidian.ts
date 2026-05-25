/**
 * vitest 用の最小 obsidian モック（runtime stub）。
 * obsidian npm は型定義中心で実体は Obsidian アプリが提供するため、
 * 値として import される名前にスタブを与える（vitest.config.ts の alias で解決）。
 * 純ロジック Atom（vault-io / marp-core-render / pdf-exporter / marp-file）の
 * 単体テストに必要な範囲だけ。ItemView 等の DOM 動作は live dogfood で確認する。
 */
export function normalizePath(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\.\//, '')
}

export class TFile {}
export class TFolder {}
export class ItemView {}
export class Plugin {}
export class Notice {
  constructor(_message?: string) {}
}
export class WorkspaceLeaf {}
export class Editor {}
export class Vault {}
