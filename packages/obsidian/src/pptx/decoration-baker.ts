/**
 * decoration-baker — 装飾スペックから「焼き PNG（base64 data-URI）」を決定的に生成する純関数。
 * CSS gradient は PDF 書き出しで shading 化されビューア（pdf.js 等）がピンク誤描画する。
 * また Chrome headless 焼きは非対称になる事故があった（profile cover glow がピーク 70% 偏り・端 alpha 23）。
 * → ピクセル単位で生成し、対称性・端 alpha 0・サイズを生成器側で保証する。
 * 焼き込み済み base64 は profile-assets.ts にコミットされるため、pngjs は devDependency。
 * 設計: Atom-DecorationBaker.md / 罠の根拠: [[conic-gradientはPDFビューアでピンク化する]]
 */
import { PNG } from 'pngjs'

export interface GlowSpec {
  /** 正方キャンバスの一辺(px) */
  size: number
  /** グロー色 [r,g,b] */
  color: [number, number, number]
  /** 中心 alpha (0-255) */
  peakAlpha: number
  /** alpha が 0 に落ちる半径 ÷ (size/2)。< 1 で透過マージンを残す（端 alpha 0 を保証） */
  radiusRatio: number
}

export interface LinearSpec {
  w: number
  h: number
  /** CSS 角度（12 時起点・時計回り, deg）。135 で左上(from)→右下(to) */
  angleDeg: number
  from: [number, number, number]
  to: [number, number, number]
}

function toDataUri(png: PNG): string {
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`
}

/**
 * 対称ラジアルグロー。alpha = peakAlpha * 0.5*(1+cos(π·r/R))（r≥R で 0）。
 * raised-cosine は中心・端とも導関数 0 ＝ リング無しで端まで滑らかに 0 に落ちる。
 * R を size/2 未満（radiusRatio<1）に取ると外周は完全透過 → box clip しても hard edge が出ない。
 */
export function bakeRadialGlow(spec: GlowSpec): string {
  const { size, peakAlpha } = spec
  const [r, g, b] = spec.color
  const png = new PNG({ width: size, height: size })
  const c = size / 2
  const radius = c * spec.radiusRatio
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x + 0.5 - c, y + 0.5 - c)
      const a = dist >= radius ? 0 : peakAlpha * 0.5 * (1 + Math.cos(Math.PI * (dist / radius)))
      const idx = (y * size + x) * 4
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = Math.round(a)
    }
  }
  return toDataUri(png)
}

/**
 * 角度付き 2 色 linear グラデ（不透過）。CSS 角度 θ を画像座標（y 下向き）の
 * 方向ベクトル (sinθ, -cosθ) に変換し、各ピクセルの射影を 4 隅の min/max で
 * 正規化した t∈[0,1] で from→to を線形補間する。
 */
export function bakeLinearGradient(spec: LinearSpec): string {
  const { w, h, angleDeg } = spec
  const [fr, fg, fb] = spec.from
  const [tr, tg, tb] = spec.to
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const projs = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([px, py]) => px * dx + py * dy)
  const min = Math.min(...projs)
  const span = Math.max(...projs) - min || 1
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (x * dx + y * dy - min) / span
      const idx = (y * w + x) * 4
      png.data[idx] = Math.round(fr + (tr - fr) * t)
      png.data[idx + 1] = Math.round(fg + (tg - fg) * t)
      png.data[idx + 2] = Math.round(fb + (tb - fb) * t)
      png.data[idx + 3] = 255
    }
  }
  return toDataUri(png)
}
