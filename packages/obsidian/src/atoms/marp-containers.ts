/**
 * Atom-MarpContainers (Logic): `:::` ブロックコンテナ記法を oyakudachi コンポーネント
 * HTML に展開する markdown-it 拡張。リッチ要素を生 HTML でなく markdown ネイティブに書ける。
 *
 * 2 系統:
 *  - 構造系 `:::name.mod` → <div class="name mod">…</div>（body は block 描画、任意ネスト）
 *  - 値系（inline span を持つ）→ 属性で値注入 + body を renderInline（<p> で包まない）
 *
 * html:true 維持＝生 HTML も従来通り動く。`:::` は opt-in 加算。
 * 設計: Atom-MarpContainers.md
 */

/** createRenderMarp が渡す marp.markdown（markdown-it）の使用部分のみの構造型。 */
interface MarkdownItLike {
  block: {
    ruler: {
      before(beforeName: string, ruleName: string, fn: BlockRule, options?: { alt?: string[] }): void
    }
  }
}
type BlockRule = (state: any, startLine: number, endLine: number, silent: boolean) => boolean

interface ParsedInfo {
  name: string
  /** name + modifiers をスペース連結した class 文字列。 */
  classes: string
  attrs: Record<string, string>
  flags: string[]
}

/** info 文字列を name.mod + key=val/key="..."/裸フラグ に分解。 */
export function parseContainerInfo(info: string): ParsedInfo {
  const m = info.trim().match(/^(\S+)\s*([\s\S]*)$/)
  const nameToken = m ? m[1] : info.trim()
  const rest = m ? m[2] : ''
  const [name, ...mods] = nameToken.split('.')
  const attrs: Record<string, string> = {}
  const flags: string[] = []
  const re = /([\w-]+)=(?:"([^"]*)"|(\S+))|(\S+)/g
  let mm: RegExpExecArray | null
  while ((mm = re.exec(rest))) {
    if (mm[1] !== undefined) attrs[mm[1]] = mm[2] !== undefined ? mm[2] : mm[3]
    else if (mm[4] !== undefined) flags.push(mm[4])
  }
  return { name, classes: [name, ...mods].join(' '), attrs, flags }
}

function esc(s: string | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 値系コンテナ: open/close を属性から組み立て、body は renderInline で挟む。 */
const INLINE: Record<string, { open: (p: ParsedInfo) => string; close: (p: ParsedInfo) => string }> = {
  donut: {
    open: (p) =>
      `<div class="donut-item"><div class="donut" style="--val:${esc(p.attrs.val)}"><span class="pct">${esc(p.attrs.val)}<span class="u">%</span></span></div><span class="cap">`,
    close: () => `</span></div>`,
  },
  kpi: {
    open: (p) => `<div class="kpi"><span class="n">${esc(p.attrs.val)}<span class="u">${esc(p.attrs.unit)}</span></span><span class="k">`,
    close: () => `</span></div>`,
  },
  stat: {
    open: (p) => `<div class="stat"><span class="big">${esc(p.attrs.val)}<span class="unit">${esc(p.attrs.unit)}</span></span><span class="label">`,
    close: () => `</span></div>`,
  },
  'toc-item': {
    open: (p) => `<div class="toc-item"><span class="no">${esc(p.attrs.no)}</span><span class="ttl">`,
    close: (p) => `</span><span class="pg">${esc(p.attrs.page)}</span></div>`,
  },
  'case-row': {
    open: (p) => `<div class="${p.classes}"><span class="label">${esc(p.attrs.label)}</span><p>`,
    close: () => `</p></div>`,
  },
  'case-quote': {
    open: () => `<blockquote class="case-quote">`,
    close: (p) => `${p.attrs.cite ? `<cite>— ${esc(p.attrs.cite)}</cite>` : ''}</blockquote>`,
  },
  'case-head': {
    open: (p) =>
      `<div class="case-head"><span class="logo">${esc(p.attrs.logo) || 'LOGO'}</span><div><span class="company">${esc(p.attrs.company)}</span><span class="industry">${esc(p.attrs.industry)}</span></div></div>`,
    close: () => ``,
  },
}

/** 単一行ラベル系: <div class="name"> + body を renderInline（<p> で包まない）。
 *  inline-flex/inline-block 等のスタイルに <p> が入ると崩れるため。 */
const INLINE_TEXT = new Set(['meta', 'chno', 'btn', 'logos-note', 'callout'])

/** body を block 描画するが open/close HTML をカスタムするコンテナ。 */
const BLOCK_CUSTOM: Record<string, { open: (p: ParsedInfo) => string; close: () => string }> = {
  card: {
    open: (p) => `<div class="${p.classes}">${p.attrs.icon ? `<div class="icon">${esc(p.attrs.icon)}</div>` : ''}`,
    close: () => `</div>`,
  },
  step: {
    open: (p) => `<div class="step"><div class="num">${esc(p.attrs.no)}</div><div class="body">`,
    close: () => `</div></div>`,
  },
}

/**
 * inline トークンを push する。content は markdown-it の phase2（core 'inline' ルール）で
 * children に解析される。**ブロックパース中に md.renderInline() を再入呼びすると
 * marpit のディレクティブ収集（theme 等）が壊れる**ため、必ずこの遅延方式を使う。
 */
function pushInline(state: any, content: string, lineFrom: number, lineTo: number): void {
  if (!content) return
  const t = state.push('inline', '', 0)
  t.content = content
  t.map = [lineFrom, lineTo]
  t.children = []
}

const OPEN_RE = /^(:{3,})\s*(\S[\s\S]*)$/ // コロン3+ ＋ info（開始）
const CLOSE_RE = /^:{3,}\s*$/ // コロンのみ（閉じ）

/**
 * markdown-it に `:::` コンテナルールを登録する。createRenderMarp が
 * `applyMarpContainers(marp.markdown)` で呼ぶ。
 */
export function applyMarpContainers(md: MarkdownItLike): void {
  const rule: BlockRule = (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const line = state.src.slice(start, max)
    const openM = line.match(OPEN_RE)
    if (!openM) return false
    if (silent) return true

    const parsed = parseContainerInfo(openM[2])

    // 対応する閉じ（裸 :::）を depth カウントで探す
    let depth = 1
    let closeLine = endLine
    let l = startLine
    while (++l < endLine) {
      const s2 = state.bMarks[l] + state.tShift[l]
      const m2 = state.eMarks[l]
      const t = state.src.slice(s2, m2)
      if (CLOSE_RE.test(t)) {
        if (--depth === 0) {
          closeLine = l
          break
        }
      } else if (OPEN_RE.test(t)) {
        depth++
      }
    }

    // 値系: open HTML → inline トークン（body）→ close HTML。
    // body は phase2 で inline 解析（bold 等保持）。renderInline 再入は禁止（theme 破壊）。
    const inlineDef = INLINE[parsed.name]
    if (inlineDef) {
      const bodyRaw = state.getLines(startLine + 1, closeLine, 0, false).trim()
      state.push('html_block', '', 0).content = inlineDef.open(parsed)
      pushInline(state, bodyRaw, startLine + 1, closeLine)
      state.push('html_block', '', 0).content = inlineDef.close(parsed)
      state.line = closeLine + 1
      return true
    }

    // 単一行ラベル系: <div class="..."> + renderInline body（<p> で包まない）
    if (INLINE_TEXT.has(parsed.name)) {
      const bodyRaw = state.getLines(startLine + 1, closeLine, 0, false).trim()
      state.push('html_block', '', 0).content = `<div class="${parsed.classes}">`
      pushInline(state, bodyRaw, startLine + 1, closeLine)
      state.push('html_block', '', 0).content = `</div>`
      state.line = closeLine + 1
      return true
    }

    // 構造系 / body-block 系: open → body を block 再帰描画 → close
    const blockDef = BLOCK_CUSTOM[parsed.name]
    const openHTML = blockDef ? blockDef.open(parsed) : `<div class="${parsed.classes}">`
    const closeHTML = blockDef ? blockDef.close() : `</div>`

    let token = state.push('html_block', '', 0)
    token.content = openHTML + '\n'
    token.map = [startLine, startLine + 1]

    const oldMax = state.lineMax
    const oldParent = state.parentType
    state.lineMax = closeLine
    state.parentType = 'marp_container'
    state.md.block.tokenize(state, startLine + 1, closeLine)
    state.lineMax = oldMax
    state.parentType = oldParent

    token = state.push('html_block', '', 0)
    token.content = closeHTML + '\n'
    token.map = [closeLine, closeLine + 1]

    state.line = closeLine + 1
    return true
  }

  // alt: 段落/リスト/blockquote の途中でも `:::` で中断できるよう terminator 登録
  // （これが無いとテキスト行直後の ::: が段落に吸収される）
  md.block.ruler.before('fence', 'marp_container', rule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
}
