import { describe, it, expect } from 'vitest'
import { Marp } from '@marp-team/marp-core'
import { applyMarpContainers, parseContainerInfo } from './marp-containers'

/** marp に containers を適用して render し html を返すヘルパ。 */
function render(md: string): string {
  const marp = new Marp({ html: true })
  applyMarpContainers(marp.markdown)
  return marp.render(md).html
}

describe('parseContainerInfo', () => {
  it('name.mod を class に、key=val を attrs に分解', () => {
    const p = parseContainerInfo('card-grid.cols-3')
    expect(p.name).toBe('card-grid')
    expect(p.classes).toBe('card-grid cols-3')
  })

  it('key="quoted value"（空白・全角スラッシュ込み）が壊れない', () => {
    const p = parseContainerInfo('case-head company="株式会社○○ ／ 製造業" logo=LOGO')
    expect(p.attrs.company).toBe('株式会社○○ ／ 製造業')
    expect(p.attrs.logo).toBe('LOGO')
  })

  it('裸フラグを flags に、modifier を classes に', () => {
    const p = parseContainerInfo('case-row.result label=効果')
    expect(p.classes).toBe('case-row result')
    expect(p.attrs.label).toBe('効果')
  })
})

describe('applyMarpContainers — 構造系', () => {
  it(':::name → <div class="name">', () => {
    expect(render(':::card-grid\n:::')).toContain('<div class="card-grid">')
  })

  it(':::name.mod → 複数 class', () => {
    expect(render(':::card-grid.cols-3\n:::')).toContain('<div class="card-grid cols-3">')
  })

  it('未登録 name はフォールバックで <div class="name">', () => {
    expect(render(':::foo\n:::')).toContain('<div class="foo">')
  })

  it('テキスト段落の直後の ::: が段落に吸収されず展開される（alt terminator）', () => {
    const html = render('説明文がここにある。\n:::callout\n注意点\n:::')
    expect(html).toContain('<div class="callout">')
    expect(html).not.toContain(':::callout')
  })

  it('ネスト: card-grid 内の card、本文の ### が h3 に描画される', () => {
    const html = render(
      ':::card-grid\n:::card icon=📈\n### 業務の効率化\n最短1日に短縮。\n:::\n:::',
    )
    expect(html).toContain('<div class="card-grid">')
    expect(html).toContain('<div class="card">')
    expect(html).toContain('<div class="icon">📈</div>')
    expect(html).toContain('業務の効率化')
    expect(html).toMatch(/<h3[^>]*>業務の効率化<\/h3>/)
  })
})

describe('applyMarpContainers — 値系', () => {
  it('donut: --val とリング、本文が cap に', () => {
    const html = render(':::donut val=68\n負担が大きいと回答\n:::')
    expect(html).toContain('--val:68')
    expect(html).toContain('class="pct"')
    expect(html).toContain('class="cap"')
    expect(html).toContain('負担が大きいと回答')
  })

  it('toc-item: no / ttl(本文) / page', () => {
    const html = render(':::toc-item no=01 page=P.03\n市場環境と課題\n:::')
    expect(html).toMatch(/<span class="no">01<\/span>/)
    expect(html).toMatch(/<span class="ttl">市場環境と課題<\/span>/)
    expect(html).toMatch(/<span class="pg">P.03<\/span>/)
  })

  it('kpi: 数字 + unit + 本文ラベル', () => {
    const html = render(':::kpi val=90 unit=%\n手作業の削減率\n:::')
    expect(html).toContain('class="kpi"')
    expect(html).toContain('90')
    expect(html).toContain('手作業の削減率')
  })

  it('case-row.result: ラベル + 本文の inline markdown(bold) が保持される', () => {
    const html = render(':::case-row.result label=効果\n作業時間を**90%削減**。\n:::')
    expect(html).toContain('class="case-row result"')
    expect(html).toMatch(/<span class="label">効果<\/span>/)
    expect(html).toContain('<strong>90%削減</strong>')
  })

  it('case-quote: blockquote + cite', () => {
    const html = render(':::case-quote cite="○○部 部長"\n負担が減りました。\n:::')
    expect(html).toContain('<blockquote class="case-quote">')
    expect(html).toContain('負担が減りました。')
    expect(html).toMatch(/<cite>— ○○部 部長<\/cite>/)
  })
})

describe('applyMarpContainers — 単一行ラベル系（inline-text）', () => {
  it('chno は <p> で包まれず inline で描画（inline-flex 崩れ防止）', () => {
    const html = render(':::chno\nCHAPTER 01\n:::')
    expect(html).toContain('<div class="chno">CHAPTER 01</div>')
    expect(html).not.toMatch(/<div class="chno"><p>/)
  })

  it('callout は inline で bold を保持', () => {
    const html = render(':::callout\n負担は**最大要因**だ\n:::')
    expect(html).toContain('<div class="callout">')
    expect(html).toContain('<strong>最大要因</strong>')
    expect(html).not.toMatch(/<div class="callout"><p>/)
  })
})

describe('applyMarpContainers — 後方互換', () => {
  it('生 HTML の <div class="card"> は従来通り出力される', () => {
    const html = render('<div class="card">中身</div>')
    expect(html).toContain('class="card"')
    expect(html).toContain('中身')
  })
})
