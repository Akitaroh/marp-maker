/**
 * oyakudachi — B2B「お役立ち資料」向け marp テーマ（A4 縦、ページ型レイアウト付き）。
 *
 * SAIRU お役立ち資料テンプレ相当のページ型を marp `_class` + CSS で提供する:
 *   cover（表紙）/ lead（はじめに）/ chapter（章扉）/ stat（数字強調）/
 *   cards（アイコン+説明グリッド）/ compare（before-after 2カラム）/ cta（問い合わせ）
 * カード・2カラム等は HTML-in-markdown を使うため、描画側で marp の html を有効化すること
 *（createRenderMarp が `new Marp({ html: true })`）。deck は利用者自身が書く信頼入力で、
 *  プレビューは sandbox iframe（script 不可）なので許容。
 *
 * ブランド色は :root の CSS 変数 1 箇所で変えられる（再ブランド容易）。
 * NOTE: 配布プラグインを self-contained にするため文字列同梱（whitepaper-a4 と同方針）。
 */
export const OYAKUDACHI_THEME_NAME = 'oyakudachi'

export const OYAKUDACHI_CSS = `/* @theme oyakudachi */
/* @size A4 793px 1122px */
@import 'default';

:root {
  --brand: #1b3a6b;      /* 主役（紺）— ここを変えると全体のブランド色が変わる */
  --accent: #0096d6;     /* アクセント（明るい青）*/
  --ink: #1a1a1a;        /* 本文 */
  --muted: #6b7280;      /* 補助テキスト */
  --line: #e5e7eb;       /* 罫線 */
  --tint: #eef4fb;       /* 淡い背景（カード/コールアウト）*/
  --pad: 56px;
}

section {
  width: 793px;
  height: 1122px;
  padding: var(--pad);
  background: #ffffff;
  color: var(--ink);
  font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  font-size: 12pt;
  line-height: 1.75;
}

/* 見出し */
section h1 { color: var(--brand); font-size: 26pt; font-weight: 800; margin: 0 0 20px; }
section h2 {
  color: var(--brand); font-size: 19pt; font-weight: 800;
  margin: 0 0 16px; padding: 0 0 8px 14px; position: relative;
}
section h2::before {
  content: ''; position: absolute; left: 0; top: 2px; bottom: 10px;
  width: 5px; border-radius: 3px; background: var(--accent);
}
section h3 { font-size: 14pt; font-weight: 700; margin: 18px 0 8px; color: var(--ink); }

section p { margin: 0 0 12px; }
section ul, section ol { margin: 0 0 14px; padding-left: 1.3em; }
section li { margin-bottom: 7px; }
section strong { color: var(--brand); }
section a { color: var(--accent); }

section blockquote {
  border-left: 4px solid var(--accent); padding: 4px 0 4px 16px;
  margin: 14px 0; color: var(--muted);
}
section code {
  background: var(--tint); color: var(--brand); padding: 2px 7px;
  border-radius: 4px; font-family: 'SF Mono', Consolas, monospace; font-size: 10.5pt;
}
section pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; }
section pre code { background: transparent; color: inherit; }

/* 表 */
section table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11pt; }
section th, section td { border: 1px solid var(--line); padding: 9px 12px; text-align: left; vertical-align: top; }
section th { background: var(--brand); color: #fff; font-weight: 700; }
section tr:nth-child(even) td { background: var(--tint); }

/* フッター CTA 帯 + ページ番号 */
section footer {
  position: absolute; left: var(--pad); right: var(--pad); bottom: 24px;
  font-size: 9pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 8px;
}
section::after { color: var(--muted); font-size: 9pt; bottom: 24px; right: var(--pad); }

/* ============ ページ型 ============ */

/* 表紙: _class: cover */
section.cover {
  background: linear-gradient(135deg, var(--brand) 0%, #122a52 100%);
  color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 72px;
}
section.cover h1 { color: #fff; font-size: 34pt; line-height: 1.35; margin-bottom: 18px; }
section.cover h2 { color: #cfe2f6; font-size: 16pt; font-weight: 500; padding: 0; }
section.cover h2::before { display: none; }
section.cover strong { color: var(--accent); }
section.cover hr { border: 0; border-top: 1px solid rgba(255,255,255,.25); margin: 28px 0; }
section.cover .meta { color: #adc6e6; font-size: 12pt; }

/* はじめに/リード: _class: lead */
section.lead { background: var(--tint); }
section.lead h1 { font-size: 28pt; }

/* 章扉: _class: chapter */
section.chapter {
  background: var(--brand); color: #fff;
  display: flex; flex-direction: column; justify-content: center; padding: 72px;
}
section.chapter .chno { color: var(--accent); font-size: 16pt; font-weight: 800; letter-spacing: .12em; }
section.chapter h1 { color: #fff; font-size: 32pt; margin: 8px 0 20px; }
section.chapter p { color: #cfe2f6; font-size: 12.5pt; max-width: 80%; }
section.chapter h2::before { display: none; }

/* 数字強調: _class: stat（中の .stat を使う）*/
.stat { text-align: center; margin: 28px 0; }
.stat .big { display: block; color: var(--brand); font-size: 72pt; font-weight: 800; line-height: 1; }
.stat .unit { font-size: 28pt; }
.stat .label { display: block; color: var(--muted); font-size: 13pt; margin-top: 10px; }

/* カードグリッド（アイコン+見出し+説明）: <div class="card-grid"> */
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0; }
.card-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.card {
  background: #fff; border: 1px solid var(--line); border-radius: 12px;
  padding: 18px 18px 16px; box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.card .icon {
  width: 44px; height: 44px; border-radius: 50%; background: var(--tint);
  color: var(--brand); display: flex; align-items: center; justify-content: center;
  font-size: 22pt; margin-bottom: 12px;
}
.card h3 { margin: 0 0 6px; color: var(--brand); font-size: 13pt; }
.card p { margin: 0; color: var(--ink); font-size: 10.5pt; line-height: 1.6; }

/* 番号バッジ付きリスト: <div class="steps"> 内の .step */
.step { display: flex; gap: 14px; align-items: flex-start; margin: 0 0 16px; }
.step .num {
  flex: 0 0 auto; width: 34px; height: 34px; border-radius: 50%;
  background: var(--brand); color: #fff; font-weight: 800;
  display: flex; align-items: center; justify-content: center; font-size: 13pt;
}
.step .body h3 { margin: 2px 0 4px; }
.step .body p { margin: 0; color: var(--muted); font-size: 10.5pt; }

/* before/after など2カラム: <div class="cols"> */
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 10px 0; }
.cols .col { border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.cols .col h3 { margin: 0 0 10px; font-size: 13pt; }
.cols .col.before { background: #fafafa; }
.cols .col.before h3 { color: var(--muted); }
.cols .col.after { background: var(--tint); border-color: var(--accent); }
.cols .col.after h3 { color: var(--brand); }

/* コールアウト: <div class="callout"> */
.callout {
  background: var(--tint); border-left: 5px solid var(--accent);
  border-radius: 8px; padding: 16px 18px; margin: 14px 0;
}

/* ロゴウォール: <div class="logos"> */
.logos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
.logos > * {
  border: 1px solid var(--line); border-radius: 8px; height: 64px;
  display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 10pt;
}

/* CTA: _class: cta */
section.cta { background: var(--tint); display: flex; flex-direction: column; justify-content: center; }
section.cta h1 { font-size: 26pt; }
.cta-box {
  background: var(--brand); color: #fff; border-radius: 14px; padding: 28px 32px; margin: 18px 0;
}
.cta-box h3 { color: #fff; margin: 0 0 8px; font-size: 16pt; }
.cta-box .btn {
  display: inline-block; background: var(--accent); color: #fff; font-weight: 700;
  padding: 10px 22px; border-radius: 8px; margin-top: 12px;
}
`
