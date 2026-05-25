/**
 * Atom-MarpBoard — MCP Apps の ui:// iframe 内で動く会話内 board。
 *
 * host が show_marp ツールで返す marp markdown を marp-core で描画し、
 * ◀▶ でページ送りする。フレームワーク無しの vanilla TS。
 * 設計: 50_Mission/zddmission/MarpMaker/Atom-MarpBoard.md
 */
import { App } from '@modelcontextprotocol/ext-apps'
import { Marp } from '@marp-team/marp-core'

const statusEl = document.getElementById('status')!
const slideEl = document.getElementById('slide')!
const prevBtn = document.getElementById('prev') as HTMLButtonElement
const nextBtn = document.getElementById('next') as HTMLButtonElement
const pageInfo = document.getElementById('pageinfo')!

const PLACEHOLDER_MD = `# Marp Board

show_marp ツールで marp markdown を渡すと、ここに描画される。

---

## ページ送り

◀▶ で複数ページを捲れる。marp-core が iframe 内で描画している。
`

let slides: HTMLElement[] = []
let idx = 0

function show(i: number): void {
  if (slides.length === 0) return
  idx = Math.max(0, Math.min(i, slides.length - 1))
  slides.forEach((s, n) => {
    s.style.display = n === idx ? 'block' : 'none'
  })
  pageInfo.textContent = `${idx + 1} / ${slides.length}`
  prevBtn.disabled = idx === 0
  nextBtn.disabled = idx === slides.length - 1
}

function renderMarp(markdown: string): boolean {
  try {
    const marp = new Marp()
    const { html, css } = marp.render(markdown)
    slideEl.innerHTML = `<style>${css}</style>${html}`
    slides = Array.from(slideEl.querySelectorAll<HTMLElement>('svg[data-marpit-svg]'))
    show(0)
    return true
  } catch (e) {
    statusEl.textContent = '❌ marp-core 描画失敗: ' + String(e)
    return false
  }
}

prevBtn.addEventListener('click', () => show(idx - 1))
nextBtn.addEventListener('click', () => show(idx + 1))

const app = new App({ name: 'Marp Board', version: '0.1.0' })

// host が show_marp の結果（markdown）を push してきたら描画
app.ontoolresult = (result) => {
  const md = result.content?.find((c) => c.type === 'text')?.text
  if (md && renderMarp(md)) {
    statusEl.textContent = `📄 ${slides.length} ページ（◀▶ で送れる）`
  }
}

app
  .connect()
  .then(() => {
    if (slides.length === 0) renderMarp(PLACEHOLDER_MD)
    statusEl.textContent =
      slides.length > 0 ? `📄 ${slides.length} ページ（◀▶ で送れる）` : '✅ connected'
  })
  .catch((e) => {
    statusEl.textContent = '❌ connect failed: ' + String(e)
  })
