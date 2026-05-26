/**
 * whitepaper-pro — SAIRU お役立ち資料テンプレの構成を忠実再現した B2B 資料テーマ（A4 縦）。
 * oyakudachi と別デザイン。`:::` 記法（Atom-MarpContainers）は共通＝同じ deck で theme 切替可。
 * 構成は SAIRU 忠実 / 色は中立（navy + teal）で配布の商標リスク回避。
 * 設計: Atom-WhitepaperProTheme.md
 */
export const WHITEPAPER_PRO_THEME_NAME = 'whitepaper-pro'

export const WHITEPAPER_PRO_CSS = `/* @theme whitepaper-pro */
/* @size A4 793px 1122px */
@import 'default';

:root {
  --brand: #1c3d5a;   /* navy */
  --accent: #0f9b9b;  /* teal（SAIRU 風だが独自値）*/
  --ink: #232a31;
  --muted: #7b8794;
  --line: #e3e8ec;
  --tint: #eef2f5;    /* ヘッダー帯/プレースホルダ背景 */
  --shadow: 20,40,64;
  --pad: 56px;
}

section {
  width: 793px; height: 1122px; padding: var(--pad);
  background: #fff; color: var(--ink); position: relative; display: block;  /* 既定の flex中央寄せを解除→上揃え */
  font-family: 'Hiragino Sans','Noto Sans JP',sans-serif; font-size: 12pt; line-height: 1.8;
}
section h1 { color: var(--brand); font-size: 26pt; font-weight: 800; margin: 0 0 18px; }
section h2 { color: var(--brand); font-size: 20pt; font-weight: 800; line-height: 1.4; margin: 0 0 16px; }
section h3 { color: var(--brand); font-size: 14pt; font-weight: 800; margin: 16px 0 8px; }
section p { margin: 0 0 12px; }
section ul, section ol { margin: 0 0 14px; padding-left: 1.3em; }
section li { margin-bottom: 6px; }
section li::marker { color: var(--accent); }
section strong { color: var(--brand); }
section a { color: var(--accent); }

/* 表（GFM 上書き）*/
section table { display: table; width: 100%; border-collapse: separate; border-spacing: 0; margin: 16px 0; font-size: 11pt; border-radius: 6px; overflow: hidden; border: 1px solid var(--line); }
section table th, section table td { border: none; border-top: 1px solid var(--line); padding: 11px 14px; text-align: left; }
section table thead th { border-top: none; }
section table th { background: var(--brand); color: #fff; font-weight: 700; }
section table tbody tr:nth-child(even) td { background: var(--tint); }

/* ===== 本文系スライド: 上部バー + ヘッダー帯（eyebrow + title on tint）===== */
/* marp 既定の place-content:center（block でも効く縦中央寄せ）を解除して上揃えに */
section:not(.cover):not(.chapter):not(.cta):not(.lead) { border-top: 5px solid var(--brand); align-content: start; padding-top: 0; }

section:not(.cover):not(.chapter):not(.cta):not(.lead) > header,
section:not(.cover):not(.chapter):not(.cta):not(.lead) > h2 {
  position: static;   /* marp 既定の absolute header を flow に戻す */
  background: var(--tint);
  margin-left: calc(-1 * var(--pad)); margin-right: calc(-1 * var(--pad));
  padding-left: var(--pad); padding-right: var(--pad);
}
/* eyebrow: 高詳細度で marp 既定 margin:0 を確実に上書き、帯を上端(バー直下)まで break */
section:not(.cover):not(.chapter):not(.cta):not(.lead) > header {
  margin-top: 0; margin-bottom: 0; padding-top: 28px;
  color: var(--accent); font-weight: 800; font-size: 12pt; letter-spacing: .04em;
}
section:not(.cover):not(.chapter):not(.cta):not(.lead) > header::after {
  content: ''; display: block; width: 30px; height: 3px; margin-top: 8px; background: var(--accent); border-radius: 2px;
}
/* title 行（帯の下部）*/
section:not(.cover):not(.chapter):not(.cta):not(.lead) > h2 { padding-top: 6px; padding-bottom: 26px; margin-bottom: 32px; }
section:not(.cover):not(.chapter):not(.cta):not(.lead) > header + h2 { padding-top: 4px; }
section:not(.cover):not(.chapter):not(.cta):not(.lead) > h2:first-child { margin-top: 0; padding-top: 28px; }

/* ===== フッター: 会社名(左) | CTA(.foot-cta 中央) | ページ番号(右) ===== */
section footer {
  position: absolute; left: var(--pad); right: var(--pad); bottom: 26px;
  display: flex; align-items: center; font-size: 9pt; color: var(--muted);
  border-top: 1px solid var(--line); padding-top: 10px; letter-spacing: .08em;
}
section footer .foot-cta { margin: 0 auto; color: var(--accent); font-weight: 700; letter-spacing: 0; }
section::after { color: var(--muted); font-size: 9pt; bottom: 26px; right: var(--pad); }

/* ===== 番号付きポイント（:::step を SAIRU 風に: accent番号 + 見出し + 本文）===== */
.step { display: flex; gap: 14px; align-items: baseline; margin: 0 0 26px; }
.step .num { flex: 0 0 auto; color: var(--accent); font-size: 17pt; font-weight: 800; line-height: 1.2; }
.step .num::after { content: '.'; }
.step .body { flex: 1 1 auto; }
.step .body h3 { margin: 0 0 4px; color: var(--brand); font-size: 14pt; }
.step .body p { margin: 0; color: var(--ink); }

/* 2カラム（:::cols/:::col を SAIRU 風プレーン: 枠なし、テキスト | 図）*/
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: center; margin: 8px 0 0; }
.col { padding: 0; border: 0; background: none; font-size: 11pt; color: var(--ink); line-height: 1.85; }

/* 画像プレースホルダ（:::imgbox → 灰色枠 "IMG"。実画像は中に img）*/
.imgbox {
  background: #d7dde2; border-radius: 4px; min-height: 150px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; letter-spacing: .1em; font-size: 11pt;
}
.imgbox img { width: 100%; height: auto; border-radius: 4px; }

/* コールアウト */
.callout { background: var(--tint); border-left: 4px solid var(--accent); border-radius: 4px; padding: 14px 18px; margin: 14px 0; }

/* ===== 全面ページ（簡易版。詳細は後続増分）===== */
section.cover { background: linear-gradient(135deg, var(--brand) 0%, #102536 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 72px; }
section.cover h1 { color: #fff; font-size: 33pt; line-height: 1.35; }
section.cover h1::before { content: ''; display: block; width: 56px; height: 5px; background: var(--accent); border-radius: 3px; margin-bottom: 22px; }
section.cover h2 { color: #cfe0ea; font-size: 15pt; font-weight: 500; }
section.cover .meta { color: #9fb4c2; font-size: 12pt; margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.2); }

section.lead { background: var(--tint); }

section.chapter { background: var(--brand); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 72px; }
section.chapter .chno { color: var(--accent); font-size: 15pt; font-weight: 800; letter-spacing: .12em; }
section.chapter h1 { color: #fff; font-size: 32pt; margin: 10px 0 18px; }
section.chapter p { color: #cfe0ea; }

section.cta { background: var(--tint); display: flex; flex-direction: column; justify-content: center; }
.cta-box { background: linear-gradient(135deg, var(--brand) 0%, #102536 100%); color: #fff; border-radius: 10px; padding: 28px 32px; margin: 16px 0; }
.cta-box h3 { color: #fff; margin: 0 0 8px; }
.cta-box .btn { display: inline-block; background: var(--accent); color: #fff; font-weight: 700; padding: 10px 22px; border-radius: 6px; margin-top: 10px; }

/* 全面/特殊ページは header/footer/ページ番号を隠す */
section.cover header, section.cover footer, section.cover::after,
section.chapter header, section.chapter footer, section.chapter::after,
section.cta header, section.cta footer, section.cta::after,
section.lead header, section.lead footer { display: none; }
`
