/**
 * Atom-ObsidianExport — Marp deck を Vault に書き出す Adapter。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-ObsidianExport.md
 *
 * 方針（非破壊・Obsidian 特性活用）:
 *   1) printToPDF spike: Electron の webContents.printToPDF で PDF 化（Chrome 不要）。
 *      ページサイズはスライド実寸に一致（parseSlideSize、A4 縦でも 16:9 横でも崩れない）。
 *      marp-cli（= Atom-MarpRenderer, core）は使わない（毎回 Chrome 起動が重い）。
 *   2) フォールバック: PDF エンジンに到達できない環境（mobile / remote 不可）では
 *      self-contained な HTML を書き出す（必ず成果物が出る）。
 *
 * 純ロジック（buildExportHtml / derivePath / exportDeck）は Obsidian/Electron 非依存で
 * テスト可能。Electron 呼び出し（renderPdfViaElectron）だけが副作用境界＝live dogfood 対象。
 */
import type { VaultIO } from './vault-io'
import type { RenderResult } from './marp-core-render'

export interface ExportDeps {
  renderMarp: (markdown: string) => RenderResult
  vaultIO: VaultIO
}

export interface ExportResult {
  kind: 'pdf' | 'html'
  path: string
}

/**
 * marp の svg viewBox からスライド実寸(px @96dpi)を取得。
 * A4 縦=793x1122 / 16:9=1280x720 等、テーマ/サイズに依らずページを実寸に合わせるため。
 * 取れなければ A4(793x1122) フォールバック。
 */
export function parseSlideSize(html: string): { w: number; h: number } {
  const m = html.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/)
  if (m) return { w: Math.round(parseFloat(m[1])), h: Math.round(parseFloat(m[2])) }
  return { w: 793, h: 1122 }
}

/**
 * marp の {html, css} を、1 スライド = 1 ページの印刷用 self-contained HTML に組む。
 * ページサイズは**スライド実寸に一致**させる（縦横どちらでも、A4 でも 16:9 でも崩れない）。
 */
export function buildExportHtml(
  rendered: RenderResult,
  size: { w: number; h: number } = parseSlideSize(rendered.html),
): string {
  const { w, h } = size
  const printCss = [
    `@page { size: ${w}px ${h}px; margin: 0; }`,
    'html,body{margin:0;padding:0;background:#fff;}',
    // 各スライド SVG をページ実寸ぴったり + ページ送り（印刷時 1 枚 1 ページ）
    `svg[data-marpit-svg]{display:block;width:${w}px;height:${h}px;page-break-after:always;break-after:page;}`,
    'svg[data-marpit-svg]:last-of-type{page-break-after:auto;break-after:auto;}',
  ].join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${rendered.css}\n${printCss}</style></head><body>${rendered.html}</body></html>`
}

/** `foo/bar.md` → `foo/bar.<ext>`（.md 以外でも拡張子を付け替える） */
export function derivePath(mdPath: string, ext: 'pdf' | 'html'): string {
  const base = mdPath.replace(/\.[^/.]+$/, '')
  return `${base}.${ext}`
}

/**
 * Electron で HTML を PDF 化（printToPDF spike）。
 * 到達できなければ null を返し、呼び出し側が HTML フォールバックする。
 * require('electron') は関数内に閉じる（mobile では top-level import で壊さないため）。
 */
async function renderPdfViaElectron(
  docHtml: string,
  size: { w: number; h: number },
): Promise<ArrayBuffer | null> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const req: ((id: string) => unknown) | undefined = (
    globalThis as { require?: (id: string) => unknown }
  ).require
  if (typeof req !== 'function') return null

  let electron: { remote?: { BrowserWindow?: unknown } } | undefined
  try {
    electron = req('electron') as typeof electron
  } catch {
    return null
  }

  // BrowserWindow へのアクセス経路（環境差を吸収）。remote が無い Obsidian では
  // @electron/remote を試す。どちらも無ければ PDF 不可 → null（HTML フォールバック）。
  let BrowserWindowCtor: unknown = electron?.remote?.BrowserWindow
  if (!BrowserWindowCtor) {
    try {
      BrowserWindowCtor = (
        req('@electron/remote') as { BrowserWindow?: unknown }
      )?.BrowserWindow
    } catch {
      /* noop */
    }
  }
  if (typeof BrowserWindowCtor !== 'function') return null

  const Ctor = BrowserWindowCtor as new (opts: unknown) => {
    loadURL(url: string): Promise<void>
    webContents: { printToPDF(opts: unknown): Promise<Uint8Array> }
    destroy(): void
  }
  const win = new Ctor({ show: false, webPreferences: { offscreen: true } })
  try {
    await win.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(docHtml),
    )
    // ページサイズをスライド実寸に一致させる。Electron printToPDF の pageSize は
    // **inch 単位**（microns ではない、実機検証で確定）。CSS px @96dpi → inch = px/96。
    // これで A4 縦でも 16:9 横でも、PDF ページがスライド規定サイズと一致する。
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: size.w / 96, height: size.h / 96 },
      margins: { marginType: 'none' },
    })
    const u8 = new Uint8Array(pdf)
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)
  } finally {
    win.destroy()
  }
}

/**
 * deck を書き出す。PDF を試み、ダメなら HTML を書き出す。どちらの成果物を出したか返す。
 */
export async function exportDeck(
  markdown: string,
  mdPath: string,
  deps: ExportDeps,
): Promise<ExportResult> {
  const rendered = deps.renderMarp(markdown)
  const size = parseSlideSize(rendered.html)
  const docHtml = buildExportHtml(rendered, size)

  // 1) printToPDF spike（Electron / Chrome 不要）。ページサイズはスライド実寸
  try {
    const pdf = await renderPdfViaElectron(docHtml, size)
    if (pdf) {
      const path = derivePath(mdPath, 'pdf')
      await deps.vaultIO.writeBinary(path, pdf)
      return { kind: 'pdf', path }
    }
  } catch {
    /* PDF 失敗時は HTML にフォールバック */
  }

  // 2) フォールバック: self-contained HTML（必ず成果物が出る）
  const path = derivePath(mdPath, 'html')
  await deps.vaultIO.writeText(path, docHtml)
  return { kind: 'html', path }
}
