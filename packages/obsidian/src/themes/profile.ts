/**
 * profile — 横型（16:9）自己紹介/プロフィール テーマ。
 * アート方向「南国ビーチ: 温かい砂色 × 海のターコイズ」（frontend-design skill で意図的に決定）。
 * クリーン・写真主役・青味の強いターコイズ差し色。表示=Zen Maru Gothic（丸み/温かみ）、
 * 本文=Zen Kaku Gothic New（Google Fonts @import、未取得時は Hiragino にフォールバック）。
 * ページ型は per-slide `_class`（cover / profile / skills / hobby / closing）+ 生 HTML（html:true）。
 * 縦型 B2B 群（oyakudachi / whitepaper-pro / monochrome = A4）とは別系統の横型テーマ。
 * 設計: Atom-ProfileTheme.md
 *
 * PDF 安全性: 大きなグラデ（表紙パネル/締め背景）は **焼いた PNG 背景**で出す。
 * CSS gradient は printToPDF で PDF シェーディング化され、一部ビューア（pdf.js 等）が
 * ピンク誤描画するため（[[conic-gradientはPDFビューアでピンク化する]] と同根）。
 */
import { COVER_GRAD, CLOSING_GRAD, COVER_GLOW, CLOSING_GLOW } from '../pptx/profile-assets'

export const PROFILE_THEME_NAME = 'profile'

export const PROFILE_CSS = `/* @theme profile */
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Zen+Maru+Gothic:wght@500;700;900&display=swap');
@import 'default';

/* ===== 南国ビーチ: 温かい砂色 × 海のターコイズ ===== */
:root {
  --sea: #0fb8c0;        /* 南国の海・ターコイズ（青味エメラルド）*/
  --sea-bright: #2dd6d4; /* 浅瀬のきらめき */
  --sea-deep: #0a8fa6;   /* 海の深み（青寄り）*/
  --sea-tint: #e6f8f8;
  --ink: #2b2926;        /* 温かいダーク */
  --muted: #877f77;      /* 温かいグレー */
  --line: #ece6de;       /* 砂の罫線 */
  --sand: #f8f4ee;       /* 温かい砂色 */
  --paper: #fffdfa;      /* ほんのり暖かい白 */
  --pad: 64px;
  --disp: 'Zen Maru Gothic','Hiragino Sans',sans-serif;
  --body: 'Zen Kaku Gothic New','Hiragino Sans','Noto Sans JP',sans-serif;
}

section {
  width: 1280px; height: 720px; padding: var(--pad);
  background: var(--paper); color: var(--ink);
  font-family: var(--body); font-size: 18px; line-height: 1.75;
  position: relative; display: block; -webkit-font-smoothing: antialiased;
}
section h1, section h2, section h3 { font-family: var(--disp); }
section h1 { font-size: 38px; font-weight: 700; margin: 0 0 12px; letter-spacing: .01em; }
section h2 { font-size: 30px; font-weight: 700; margin: 0 0 24px; }
section h3 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
section p { margin: 0 0 10px; }
section strong { color: var(--sea-deep); }
section ul { margin: 0; padding-left: 1.2em; }
section li { margin-bottom: 8px; }
section li::marker { color: var(--sea); }

/* 本文系は上揃え + 見出しの海色アクセント（短いグラデ線 + 砂色の罫）*/
section:not(.cover):not(.closing) { align-content: start; }
section:not(.cover):not(.closing) > h2 { position: relative; padding-bottom: 18px; }
section:not(.cover):not(.closing) > h2::before { content: ''; position: absolute; left: 0; bottom: 0; width: 50px; height: 4px; border-radius: 3px; background: var(--sea); }
section:not(.cover):not(.closing) > h2::after { content: ''; position: absolute; left: 60px; right: 0; bottom: 1.5px; height: 1px; background: var(--line); }

/* 写真スロット（実写真は中に <img>。プレースホルダは海色タイル）*/
.photo { background: var(--sea-tint); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: var(--sea-deep); font-size: 13px; font-weight: 700; letter-spacing: .16em; overflow: hidden; box-shadow: 0 26px 50px -26px rgba(10,143,166,.42); }
.photo img { width: 100%; height: 100%; object-fit: cover; }

/* ===== 表紙: 左テキスト / 右写真（海グラデ）===== */
section.cover { padding: 0; display: grid; grid-template-columns: 1.04fr 0.96fr; overflow: hidden; }
section.cover .cv-text { position: relative; padding: 0 76px; display: flex; flex-direction: column; justify-content: center; background: var(--paper); }
/* 砂浜に差す光: 焼いた透過 PNG グロー（CSS radial-gradient は PDF でピンク化するため画像で）*/
section.cover .cv-text::before { content: ''; position: absolute; left: -130px; bottom: -130px; width: 380px; height: 380px; background: url('${COVER_GLOW}') center / 100% 100% no-repeat; }
section.cover .cv-text > * { position: relative; }
section.cover .cv-eyebrow { color: var(--sea-deep); font-weight: 700; font-size: 14px; letter-spacing: .22em; margin-bottom: 22px; display: flex; align-items: center; gap: 12px; }
section.cover .cv-eyebrow::before { content: ''; width: 34px; height: 3px; border-radius: 2px; background: var(--sea); }
section.cover h1 { font-size: 56px; line-height: 1.16; margin: 0 0 18px; }
section.cover .cv-role { color: var(--sea-deep); font-size: 21px; font-weight: 700; font-family: var(--disp); margin-bottom: 30px; }
section.cover .cv-meta { color: var(--muted); font-size: 15px; border-top: 1px solid var(--line); padding-top: 18px; }
section.cover .cv-photo { position: relative; background: url('${COVER_GRAD}') center/cover; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; letter-spacing: .16em; font-size: 15px; }
section.cover .cv-photo img { width: 100%; height: 100%; object-fit: cover; }

/* ===== プロフィール: 左写真 / 右 bio + 情報 ===== */
section.profile .pf { display: grid; grid-template-columns: 300px 1fr; gap: 54px; align-items: start; margin-top: 4px; }
section.profile .photo { width: 300px; height: 368px; }
section.profile .pf-bio { font-size: 17px; line-height: 1.95; color: var(--ink); margin-bottom: 22px; }
.info-row { display: flex; gap: 18px; padding: 12px 2px; border-bottom: 1px solid var(--line); font-size: 16px; }
.info-row:first-of-type { border-top: 1px solid var(--line); }
.info-row .k { flex: 0 0 80px; color: var(--sea-deep); font-weight: 700; }
.info-row .v { color: var(--ink); }

/* ===== 強み: 編集的カード（上端アクセント + 大きな海色番号 + 柔らかい影）===== */
.cols3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 40px; }
.scard { position: relative; background: var(--paper); border: 1px solid var(--line); border-radius: 22px; padding: 44px 34px 38px; min-height: 300px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 4px rgba(20,40,45,.03), 0 28px 56px -22px rgba(10,143,166,.24); }
.scard::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: var(--sea); }
.scard .num { font-family: var(--disp); font-size: 52px; font-weight: 900; line-height: 1; color: var(--sea); letter-spacing: .02em; }
.scard .num::after { content: ''; display: block; width: 36px; height: 3px; border-radius: 2px; background: var(--line); margin: 18px 0 22px; }
.scard h3 { font-size: 22px; margin: 0 0 12px; color: var(--ink); }
.scard p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.85; }

/* ===== 趣味: 写真ギャラリー（写真主役）===== */
.gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; margin-top: 38px; }
.gitem .photo { width: 100%; height: 250px; margin-bottom: 18px; }
.gitem h3 { font-size: 19px; margin: 0 0 5px; color: var(--ink); }
.gitem p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.7; }

/* ===== 締め: 海グラデ + 波の光 ===== */
section.closing { padding: 0 96px; display: flex; flex-direction: column; justify-content: center; color: #fff; overflow: hidden; background: url('${CLOSING_GRAD}') center/cover; }
/* 波の光: 焼いた透過 PNG グロー */
section.closing::before { content: ''; position: absolute; right: -150px; top: -150px; width: 500px; height: 500px; background: url('${CLOSING_GLOW}') center / 100% 100% no-repeat; }
section.closing > * { position: relative; }
section.closing .cl-eyebrow { color: rgba(255,255,255,.85); font-weight: 700; font-size: 14px; letter-spacing: .22em; margin-bottom: 18px; }
section.closing h1 { color: #fff; font-size: 46px; line-height: 1.3; margin: 0 0 20px; }
section.closing p { color: rgba(255,255,255,.94); font-size: 21px; line-height: 1.75; max-width: 80%; }
section.closing strong { color: #fff; text-decoration: underline; text-decoration-color: rgba(255,255,255,.55); text-underline-offset: 5px; }
`
