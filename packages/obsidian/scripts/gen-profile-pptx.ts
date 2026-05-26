/**
 * profile 自己紹介の編集可能 pptx を書き出す runner。
 *   pnpm gen:pptx -- <出力パス> [<contentJSONパス>]
 * content JSON を渡すと差し替え、無ければ DEFAULT_SELF_INTRO（プレースホルダ）で出力。
 * 設計: Atom-ProfilePptxRenderer.md
 */
import { readFileSync } from 'node:fs'
import { writeProfilePptx, DEFAULT_SELF_INTRO, type SelfIntroContent } from '../src/pptx/profile-pptx'

const args = process.argv.slice(2).filter((a) => a !== '--')
const out = args[0] ?? 'selfintro.pptx'
const contentPath = args[1]
const content: SelfIntroContent = contentPath
  ? (JSON.parse(readFileSync(contentPath, 'utf-8')) as SelfIntroContent)
  : DEFAULT_SELF_INTRO

writeProfilePptx(out, content)
  .then(() => console.log('✅ wrote ' + out))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
