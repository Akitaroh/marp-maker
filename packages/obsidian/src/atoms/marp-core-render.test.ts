import { describe, it, expect } from 'vitest'
import { createRenderMarp } from './marp-core-render'
import { WHITEPAPER_A4_CSS } from '../themes/whitepaper-a4'

describe('createRenderMarp', () => {
  it('marp markdown を {html, css} に描画する', () => {
    const render = createRenderMarp()
    const { html, css } = render('# Hello\n\nworld')
    expect(html).toContain('svg')
    expect(css.length).toBeGreaterThan(0)
  })

  it('--- で複数スライドに分割される（section 数＝スライド数）', () => {
    const render = createRenderMarp()
    const { html } = render('# A\n\n---\n\n# B')
    const count = (html.match(/<section[ >]/g) ?? []).length
    expect(count).toBe(2)
  })

  it('whitepaper-a4 を既定テーマに適用（A4 幅 793px が css に出る）', () => {
    const render = createRenderMarp({
      themes: [WHITEPAPER_A4_CSS],
      defaultThemeName: 'whitepaper-a4',
    })
    const { css } = render('# Hello')
    expect(css).toContain('793px')
  })

  it('defaultThemeName で組込テーマ（gaia）を既定にできる', () => {
    const render = createRenderMarp({
      themes: [WHITEPAPER_A4_CSS],
      defaultThemeName: 'gaia',
    })
    const { css } = render('# Hello')
    // gaia は 16:9。A4 幅 793px は出ない
    expect(css).not.toContain('793px')
  })

  it('deck の theme: 指定が既定テーマより優先される', () => {
    const render = createRenderMarp({
      themes: [WHITEPAPER_A4_CSS],
      defaultThemeName: 'whitepaper-a4',
    })
    const { css } = render('---\ntheme: default\n---\n# Hi')
    expect(css).not.toContain('793px')
  })

  it('不正な theme css でも throw せず他テーマ/組込で描画継続', () => {
    const render = createRenderMarp({ themes: ['これは正しくない theme css {{{'] })
    expect(() => render('# Hi')).not.toThrow()
  })
})
