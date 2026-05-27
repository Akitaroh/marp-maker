/**
 * Atom-ProfilePptxRenderer (Logic): profile 自己紹介の構造化データを
 * 編集可能な pptx（pptxgenjs ネイティブ図形）に変換する。
 *
 * marp の CSS を変換するのではなく最初から pptx 図形を吐くため、全ビューアで編集可・崩れゼロ。
 * profile テーマ（南国ビーチ: 砂色 × 海ターコイズ）の見た目を pptx 座標(inch)に写像する。
 * 純ロジック（obsidian/electron 非依存）。設計: Atom-ProfilePptxRenderer.md
 */
import PptxGenJS from 'pptxgenjs'
import { COVER_GRAD, CLOSING_GRAD, COVER_GLOW, CLOSING_GLOW } from './profile-assets'

// ===== profile テーマ色（hex, # なし）=====
const SEA = '0FB8C0'
const SEA_BRIGHT = '2DD6D4'
const SEA_DEEP = '0A8FA6'
const SEA_TINT = 'E6F8F8'
const INK = '2B2926'
const MUTED = '877F77'
const LINE = 'ECE6DE'
const PAPER = 'FFFDFA'
const WHITE = 'FFFFFF'
const DISP = 'Zen Maru Gothic' // 表示（丸み/温かみ）。未搭載ビューアは置換
const BODY = 'Zen Kaku Gothic New' // 本文（クリーン）

// ===== 入力データ shape =====
export interface InfoItem {
  k: string
  v: string
}
export interface Strength {
  num: string
  title: string
  desc: string
}
export interface Hobby {
  label: string
  desc: string
  /** 画像パス（あれば addImage、無ければプレースホルダ）*/
  photo?: string
}
export interface SelfIntroContent {
  name: string
  role: string
  eyebrow?: string
  meta: string
  /** 表紙の写真パス（あれば addImage） */
  coverPhoto?: string
  bio: string
  /** プロフィールの写真パス */
  profilePhoto?: string
  info: InfoItem[]
  strengths: Strength[]
  hobbies: Hobby[]
  closing: { eyebrow?: string; title: string; body: string }
}

/** 既定プレースホルダ（marp の selfintro-sample と同内容）。利用者がここを差し替える。 */
export const DEFAULT_SELF_INTRO: SelfIntroContent = {
  name: '山田 太郎',
  role: 'フロントエンドエンジニア',
  eyebrow: 'SELF INTRODUCTION',
  meta: '2026年4月入社　／　〇〇大学 情報学部 卒',
  bio: 'はじめまして、山田太郎です。大学では情報学を専攻し、Web アプリケーションの開発に取り組んできました。ユーザーに近いものづくりが好きで、使う人の体験を一番に考えることを大切にしています。',
  info: [
    { k: '出身', v: '〇〇県〇〇市' },
    { k: '学歴', v: '〇〇大学 情報学部' },
    { k: '専門', v: 'Web フロントエンド／UI デザイン' },
    { k: '資格', v: '基本情報技術者' },
  ],
  strengths: [
    { num: '01', title: '最後までやり切る', desc: '一度引き受けた課題は、粘り強く完了まで持っていきます。' },
    { num: '02', title: '学習が速い', desc: '新しい技術もキャッチアップし、手を動かして身につけます。' },
    { num: '03', title: 'チームで動く', desc: '周囲と丁寧に連携し、全体最適を意識して進めます。' },
  ],
  hobbies: [
    { label: 'カメラ', desc: '休日は街や自然を撮り歩いています。' },
    { label: '登山', desc: '季節ごとに低山を巡るのが好きです。' },
    { label: 'コーヒー', desc: '自分で淹れて一日を始めます。' },
  ],
  closing: {
    eyebrow: 'MESSAGE',
    title: 'これからの意気込み',
    body: '入社後はフロントエンド開発で一日でも早く戦力になり、チームと事業に貢献していきたいです。どうぞよろしくお願いします。',
  },
}

type Slide = ReturnType<PptxGenJS['addSlide']>

/** 写真スロット: パスがあれば画像、無ければ海色タイル + "PHOTO" */
function addPhoto(
  pptx: PptxGenJS,
  slide: Slide,
  box: { x: number; y: number; w: number; h: number },
  photo: string | undefined,
  radius = 0.18,
): void {
  if (photo) {
    slide.addImage({ path: photo, ...box, sizing: { type: 'cover', w: box.w, h: box.h } })
    return
  }
  slide.addShape(pptx.ShapeType.roundRect, {
    ...box,
    fill: { color: SEA_TINT },
    line: { type: 'none' },
    rectRadius: radius,
  })
  slide.addText('PHOTO', {
    ...box,
    align: 'center',
    valign: 'middle',
    fontSize: 13,
    bold: true,
    color: SEA_DEEP,
    charSpacing: 3,
    fontFace: BODY,
  })
}

/** 本文系スライドの見出し（海色アクセント + 砂色の長い罫）*/
function addHeading(pptx: PptxGenJS, slide: Slide, text: string): void {
  slide.addText(text, { x: 0.9, y: 0.66, w: 8, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: DISP, valign: 'middle' })
  slide.addShape(pptx.ShapeType.rect, { x: 0.9, y: 1.4, w: 0.5, h: 0.05, fill: { color: SEA }, line: { type: 'none' } })
  slide.addShape(pptx.ShapeType.rect, { x: 1.5, y: 1.423, w: 10.93, h: 0.012, fill: { color: LINE }, line: { type: 'none' } })
}

/** profile 自己紹介コンテンツ → 編集可能 pptx（16:9）。呼出側が .write/.writeFile する。 */
export function buildProfilePptx(content: SelfIntroContent = DEFAULT_SELF_INTRO): PptxGenJS {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'PROF16x9', width: 13.333, height: 7.5 })
  pptx.layout = 'PROF16x9'

  // ===== 1. 表紙 =====
  const cover = pptx.addSlide()
  cover.background = { color: PAPER }
  // 砂浜の光（焼いた透過グロー、左下・テキスト背面）
  cover.addImage({ data: COVER_GLOW, x: -1.4, y: 5.5, w: 4.2, h: 4.2 })
  // 右: 海色パネル（写真枠）
  if (content.coverPhoto) {
    cover.addImage({ path: content.coverPhoto, x: 6.95, y: 0, w: 6.383, h: 7.5, sizing: { type: 'cover', w: 6.383, h: 7.5 } })
  } else {
    // 写真未指定: 海ターコイズのグラデ背景画像（pptx shape は solid のみ＝グラデは画像で）
    cover.addImage({ data: COVER_GRAD, x: 6.95, y: 0, w: 6.383, h: 7.5, sizing: { type: 'cover', w: 6.383, h: 7.5 } })
    cover.addText('PHOTO', { x: 6.95, y: 0, w: 6.383, h: 7.5, align: 'center', valign: 'middle', color: WHITE, fontSize: 14, bold: true, charSpacing: 3, fontFace: BODY })
  }
  // 左: eyebrow / 名前 / 肩書き / 罫 / meta
  cover.addShape(pptx.ShapeType.rect, { x: 0.9, y: 2.54, w: 0.34, h: 0.045, fill: { color: SEA_BRIGHT }, line: { type: 'none' } })
  cover.addText(content.eyebrow ?? 'SELF INTRODUCTION', { x: 1.34, y: 2.36, w: 5.2, h: 0.35, fontSize: 11, bold: true, color: SEA_DEEP, charSpacing: 3, fontFace: BODY, valign: 'middle' })
  cover.addText(content.name, { x: 0.86, y: 2.82, w: 5.9, h: 1.0, fontSize: 40, bold: true, color: INK, fontFace: DISP, valign: 'middle' })
  cover.addText(content.role, { x: 0.9, y: 3.98, w: 5.9, h: 0.5, fontSize: 18, bold: true, color: SEA_DEEP, fontFace: DISP, valign: 'middle' })
  cover.addShape(pptx.ShapeType.rect, { x: 0.9, y: 4.78, w: 4.9, h: 0.014, fill: { color: LINE }, line: { type: 'none' } })
  cover.addText(content.meta, { x: 0.9, y: 4.92, w: 5.9, h: 0.4, fontSize: 12, color: MUTED, fontFace: BODY, valign: 'middle' })

  // ===== 2. プロフィール =====
  const profile = pptx.addSlide()
  profile.background = { color: PAPER }
  addHeading(pptx, profile, 'プロフィール')
  addPhoto(pptx, profile, { x: 0.9, y: 1.95, w: 3.0, h: 3.7 }, content.profilePhoto, 0.2)
  profile.addText(content.bio, { x: 4.25, y: 1.95, w: 8.2, h: 1.5, fontSize: 14, color: INK, fontFace: BODY, lineSpacingMultiple: 1.4, valign: 'top' })
  const rowY = 3.6
  const rowH = 0.52
  content.info.forEach((item, i) => {
    profile.addText(
      [
        { text: item.k, options: { bold: true, color: SEA_DEEP } },
        { text: '     ' + item.v, options: { color: INK } },
      ],
      { x: 4.25, y: rowY + i * rowH, w: 8.2, h: rowH, fontSize: 14, fontFace: BODY, valign: 'middle' },
    )
    profile.addShape(pptx.ShapeType.rect, { x: 4.25, y: rowY + (i + 1) * rowH - 0.012, w: 8.2, h: 0.012, fill: { color: LINE }, line: { type: 'none' } })
  })

  // ===== 3. 強み =====
  const skills = pptx.addSlide()
  skills.background = { color: PAPER }
  addHeading(pptx, skills, '私の強み')
  const cardW = 3.78
  const cardGap = 0.4
  const cardY = 2.15
  const cardH = 4.35
  content.strengths.slice(0, 3).forEach((s, i) => {
    const x = 0.9 + i * (cardW + cardGap)
    skills.addShape(pptx.ShapeType.roundRect, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: PAPER }, line: { color: LINE, width: 1 }, rectRadius: 0.18,
      shadow: { type: 'outer', color: SEA_DEEP, opacity: 0.16, blur: 12, offset: 7, angle: 90 },
    })
    skills.addShape(pptx.ShapeType.rect, { x: x + 0.02, y: cardY, w: cardW - 0.04, h: 0.06, fill: { color: SEA }, line: { type: 'none' } })
    skills.addText(s.num, { x: x + 0.34, y: cardY + 0.34, w: 2, h: 0.85, fontSize: 40, bold: true, color: SEA, fontFace: DISP, valign: 'middle' })
    skills.addShape(pptx.ShapeType.rect, { x: x + 0.36, y: cardY + 1.3, w: 0.5, h: 0.04, fill: { color: LINE }, line: { type: 'none' } })
    skills.addText(s.title, { x: x + 0.34, y: cardY + 1.5, w: cardW - 0.68, h: 0.5, fontSize: 18, bold: true, color: INK, fontFace: DISP, valign: 'middle' })
    skills.addText(s.desc, { x: x + 0.34, y: cardY + 2.05, w: cardW - 0.68, h: 1.9, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.35, valign: 'top' })
  })

  // ===== 4. 趣味 =====
  const hobby = pptx.addSlide()
  hobby.background = { color: PAPER }
  addHeading(pptx, hobby, '趣味・興味')
  const itemW = 3.78
  const itemGap = 0.4
  const photoY = 2.15
  const photoH = 2.6
  content.hobbies.slice(0, 3).forEach((h, i) => {
    const x = 0.9 + i * (itemW + itemGap)
    addPhoto(pptx, hobby, { x, y: photoY, w: itemW, h: photoH }, h.photo, 0.18)
    hobby.addText(h.label, { x, y: photoY + photoH + 0.18, w: itemW, h: 0.42, fontSize: 17, bold: true, color: INK, fontFace: DISP, valign: 'middle' })
    hobby.addText(h.desc, { x, y: photoY + photoH + 0.62, w: itemW, h: 0.8, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacingMultiple: 1.3, valign: 'top' })
  })

  // ===== 5. 締め =====
  const closing = pptx.addSlide()
  closing.background = { color: SEA } // フォールバック
  // 海ターコイズのグラデ背景（画像。pptx shape は solid のみ＝グラデは画像で）
  closing.addImage({ data: CLOSING_GRAD, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } })
  // 波の光（焼いた透過グロー＝theme と統一）
  closing.addImage({ data: CLOSING_GLOW, x: 8.6, y: -2.2, w: 7.2, h: 7.2 })
  closing.addText(content.closing.eyebrow ?? 'MESSAGE', { x: 0.95, y: 2.3, w: 6, h: 0.35, fontSize: 12, bold: true, color: 'D7F5F5', charSpacing: 3, fontFace: BODY, valign: 'middle' })
  closing.addText(content.closing.title, { x: 0.95, y: 2.78, w: 11.4, h: 1.0, fontSize: 34, bold: true, color: WHITE, fontFace: DISP, valign: 'middle' })
  closing.addText(content.closing.body, { x: 0.95, y: 3.98, w: 9.6, h: 1.6, fontSize: 17, color: WHITE, fontFace: BODY, lineSpacingMultiple: 1.45, valign: 'top' })

  return pptx
}

/** 編集可能 pptx をファイルに書き出す（node）。呼出側 deliverable / runner 用。 */
export async function writeProfilePptx(
  path: string,
  content: SelfIntroContent = DEFAULT_SELF_INTRO,
): Promise<void> {
  const pptx = buildProfilePptx(content)
  await pptx.writeFile({ fileName: path })
}
