/**
 * gen-assets — decoration-baker で profile の焼き装飾アセット(src/pptx/profile-assets.ts)を再生成する。
 *   pnpm gen:assets
 * このファイルが装飾スペック(色/サイズ/peak/radius)の SoT。実行すると profile-assets.ts を上書きする。
 * 設計: Atom-DecorationBaker.md
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bakeLinearGradient, bakeRadialGlow } from '../src/pptx/decoration-baker'

// 色は profile.ts のトークン（--sea-bright #2dd6d4 等）。GRAD の端色は現行 PNG の対角から抽出（見た目踏襲）。
const assets: Record<string, string> = {
  // 面グラデ（海ターコイズ、135deg 左上→右下）
  COVER_GRAD: bakeLinearGradient({ w: 240, h: 282, angleDeg: 135, from: [44, 213, 211], to: [13, 167, 181] }),
  CLOSING_GRAD: bakeLinearGradient({ w: 320, h: 180, angleDeg: 135, from: [44, 213, 211], to: [13, 169, 182] }),
  // ソフトグロー（対称ラジアル、端 alpha 0・corner-anchor 前提）
  COVER_GLOW: bakeRadialGlow({ size: 600, color: [45, 214, 212], peakAlpha: 52, radiusRatio: 278 / 300 }),
  CLOSING_GLOW: bakeRadialGlow({ size: 620, color: [255, 255, 255], peakAlpha: 50, radiusRatio: 288 / 310 }),
}

const header = `/**
 * profile テーマ/pptx 共有の焼いた画像アセット（base64 data-URI）。
 * pptx の shape fill は solid のみ・CSS gradient は PDF でビューア ピンク化するため、
 * 面グラデ(GRAD)・ソフトグロー(GLOW)は焼いた画像で全経路(preview/PDF/pptx)対応する。
 * 生成: decoration-baker（GRAD=bakeLinearGradient / GLOW=bakeRadialGlow）。スペックは scripts/gen-assets.ts。
 * 【自動生成】手で編集しない。再生成: pnpm gen:assets
 */`

const body = Object.entries(assets)
  .map(([k, v]) => `export const ${k} = '${v}'`)
  .join('\n')

const out = join(process.cwd(), 'src/pptx/profile-assets.ts')
writeFileSync(out, `${header}\n${body}\n`)
console.log('✅ wrote ' + out)
