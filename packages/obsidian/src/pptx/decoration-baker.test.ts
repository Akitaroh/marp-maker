/**
 * decoration-baker の検証経路（Atom-DecorationBaker.md）。
 * 焼き PNG の不変条件: glow=対称・端 alpha 0・サイズ / linear=サイズ・端色。
 */
import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { bakeRadialGlow, bakeLinearGradient } from './decoration-baker'

const PREFIX = 'data:image/png;base64,'
function decode(uri: string): PNG {
  expect(uri.startsWith(PREFIX)).toBe(true)
  return PNG.sync.read(Buffer.from(uri.slice(PREFIX.length), 'base64'))
}
const alpha = (p: PNG, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3]
const rgb = (p: PNG, x: number, y: number) => {
  const i = (y * p.width + x) * 4
  return [p.data[i], p.data[i + 1], p.data[i + 2]]
}

describe('bakeRadialGlow', () => {
  const png = decode(bakeRadialGlow({ size: 120, color: [45, 214, 212], peakAlpha: 52, radiusRatio: 0.9 }))

  it('返り値が data-URI 形式で指定サイズの PNG', () => {
    expect(png.width).toBe(120)
    expect(png.height).toBe(120)
  })

  it('中心 alpha ≈ peakAlpha', () => {
    const a = alpha(png, 60, 60)
    expect(a).toBeGreaterThanOrEqual(50)
    expect(a).toBeLessThanOrEqual(52)
  })

  it('四隅・辺の alpha = 0（box clip しても hard edge が出ない）', () => {
    let border = 0
    for (let x = 0; x < 120; x++) border = Math.max(border, alpha(png, x, 0), alpha(png, x, 119))
    for (let y = 0; y < 120; y++) border = Math.max(border, alpha(png, 0, y), alpha(png, 119, y))
    expect(border).toBe(0)
  })

  it('左右・上下が対称（lopsided でない）', () => {
    let diff = 0
    for (let y = 0; y < 120; y += 3)
      for (let x = 0; x < 120; x += 3)
        diff = Math.max(
          diff,
          Math.abs(alpha(png, x, y) - alpha(png, 119 - x, y)),
          Math.abs(alpha(png, x, y) - alpha(png, x, 119 - y)),
        )
    expect(diff).toBe(0)
  })

  it('color が RGB に反映される', () => {
    expect(rgb(png, 60, 60)).toEqual([45, 214, 212])
  })
})

describe('bakeLinearGradient', () => {
  const png = decode(bakeLinearGradient({ w: 100, h: 60, angleDeg: 135, from: [44, 213, 211], to: [13, 167, 181] }))

  it('返り値が data-URI 形式で指定サイズの PNG（不透過）', () => {
    expect(png.width).toBe(100)
    expect(png.height).toBe(60)
    expect(alpha(png, 50, 30)).toBe(255)
  })

  it('135deg は左上=from・右下=to', () => {
    const tl = rgb(png, 1, 1)
    const br = rgb(png, 98, 58)
    expect(Math.abs(tl[0] - 44)).toBeLessThanOrEqual(3)
    expect(Math.abs(br[2] - 181)).toBeLessThanOrEqual(4)
    expect(br[1]).toBeLessThan(tl[1]) // 右下ほど濃い海（緑成分が下がる）
  })
})
