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
 * 立体感の motif: ハイライト要素は accent→brand の斜めグラデ、影は紺寄り（rgba(16,42,80,..)）で統一。
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
  --shadow: 16,42,80;    /* 影の色（紺）rgba(var(--shadow),a) で使う */
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
  width: 5px; border-radius: 3px;
  background: linear-gradient(180deg, var(--accent) 0%, var(--brand) 100%);
}
section h3 { font-size: 14pt; font-weight: 700; margin: 18px 0 8px; color: var(--ink); }

section p { margin: 0 0 12px; }
section ul, section ol { margin: 0 0 14px; padding-left: 1.3em; }
section li { margin-bottom: 7px; }
section li::marker { color: var(--accent); }
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

/* 表（角丸・横罫のみのモダンテーブル）
   marp 既定の GFM table（display:block; width:max-content; section table td に枠）を
   同じ section table 詳細度＋後勝ちで上書きする。これが無いとテーブルが中身幅で左に縮む。*/
section table {
  display: table; width: 100%; border-collapse: separate; border-spacing: 0; margin: 16px 0;
  font-size: 11pt; border-radius: 10px; overflow: hidden;
  border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(var(--shadow),.08);
}
section table th, section table td {
  border: none; border-top: 1px solid var(--line);
  padding: 12px 16px; text-align: left; vertical-align: top; word-break: break-word;
}
section table thead th { border-top: none; }
section table th { background: var(--brand); color: #fff; font-weight: 700; }
section table tbody tr:nth-child(even) td { background: var(--tint); }

/* フッター CTA 帯 + ページ番号 */
section footer {
  position: absolute; left: var(--pad); right: var(--pad); bottom: 24px;
  font-size: 9pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 8px;
}
section::after { color: var(--muted); font-size: 9pt; bottom: 24px; right: var(--pad); }

/* ============ ページ型 ============ */

/* 表紙: _class: cover */
section.cover {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, var(--brand) 0%, #122a52 100%);
  color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 72px;
}
/* 右上の大きな淡い光 */
section.cover::before {
  content: ''; position: absolute; top: -150px; right: -130px;
  width: 440px; height: 440px; border-radius: 50%;
  background: radial-gradient(circle at center, rgba(0,150,214,.45), rgba(0,150,214,0) 70%);
}
/* 左下の幾何リング */
section.cover::after {
  content: ''; position: absolute; left: -100px; bottom: -120px;
  width: 300px; height: 300px; border-radius: 50%;
  border: 36px solid rgba(255,255,255,.05);
}
section.cover > * { position: relative; z-index: 1; }
section.cover h1 { color: #fff; font-size: 34pt; line-height: 1.35; margin-bottom: 18px; }
/* タイトル上のアクセントバー（kicker）*/
section.cover h1::before {
  content: ''; display: block; width: 64px; height: 5px;
  background: var(--accent); border-radius: 3px; margin-bottom: 24px;
}
section.cover h2 { color: #cfe2f6; font-size: 16pt; font-weight: 500; padding: 0; }
section.cover h2::before { display: none; }
section.cover strong { color: var(--accent); }
section.cover hr { border: 0; border-top: 1px solid rgba(255,255,255,.25); margin: 28px 0; }
section.cover .meta {
  color: #adc6e6; font-size: 12pt; margin-top: 30px;
  padding-top: 18px; border-top: 1px solid rgba(255,255,255,.2);
}

/* はじめに/リード: _class: lead */
section.lead { background: var(--tint); }
section.lead h1 { font-size: 28pt; }

/* 章扉: _class: chapter */
section.chapter {
  position: relative; overflow: hidden;
  background: linear-gradient(160deg, var(--brand) 0%, #16315c 100%); color: #fff;
  display: flex; flex-direction: column; justify-content: center; padding: 72px;
}
/* 右下の淡い装飾円 */
section.chapter::before {
  content: ''; position: absolute; right: -120px; bottom: -150px;
  width: 420px; height: 420px; border-radius: 50%; background: rgba(255,255,255,.04);
}
section.chapter > * { position: relative; z-index: 1; }
section.chapter .chno {
  display: inline-flex; align-items: center;
  color: var(--accent); font-size: 15pt; font-weight: 800; letter-spacing: .14em;
}
section.chapter .chno::before {
  content: ''; width: 32px; height: 3px; background: var(--accent);
  margin-right: 14px; border-radius: 2px;
}
section.chapter h1 { color: #fff; font-size: 32pt; margin: 14px 0 20px; }
section.chapter p { color: #cfe2f6; font-size: 12.5pt; max-width: 80%; }
section.chapter h2::before { display: none; }

/* 数字強調: _class: stat（中の .stat を使う）*/
.stat {
  text-align: center; margin: 24px 0; padding: 30px 24px;
  background: var(--tint); border: 1px solid var(--line); border-radius: 18px;
}
.stat .big {
  display: block; font-size: 76pt; font-weight: 800; line-height: 1;
  color: var(--brand);
  background: linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.stat .unit { font-size: 30pt; }
.stat .label { display: block; color: var(--muted); font-size: 13pt; margin-top: 12px; }

/* ===== データ表現（単一の数字/比率の強調。複数スライスの内訳・比較グラフは mermaid 領域）===== */

/* ドーナツ%リング（SVG stroke リング）: <div class="donut"><svg…><circle .donut-ring stroke-dasharray="68 100"/></svg><span class="pct">68%…
   conic-gradient は PDF 化時に shading 埋込で一部ビューア（pdf.js 等）がピンク誤描画するため SVG ベクターで描く */
.donut {
  --size: 150px;
  width: var(--size); height: var(--size); position: relative;
  display: flex; align-items: center; justify-content: center;
}
.donut-svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.donut-track { fill: none; stroke: var(--line); stroke-width: 3.6; }
.donut-ring { fill: none; stroke: var(--accent); stroke-width: 3.6; stroke-linecap: round; }
.donut .pct { position: relative; z-index: 1; font-size: 30pt; font-weight: 800; color: var(--brand); }
.donut .pct .u { font-size: 15pt; font-weight: 700; }

/* ドーナツ横並び（実態調査の3指標など）: <div class="donut-row"> 内に .donut-item */
.donut-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; justify-items: center; margin: 20px 0; }
.donut-row .donut-item { text-align: center; }
.donut-row .donut { margin: 0 auto 12px; }
.donut-row .cap { display: block; color: var(--muted); font-size: 10.5pt; line-height: 1.5; }

/* KPI 数字の横並び: <div class="kpi-row"><div class="kpi"><span class="n">3.2<span class="u">倍</span></span><span class="k">ラベル</span></div></div> */
.kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
.kpi { text-align: center; padding: 24px 14px; background: var(--tint); border: 1px solid var(--line); border-radius: 16px; }
.kpi .n {
  display: block; font-size: 42pt; font-weight: 800; line-height: 1; color: var(--brand);
  background: linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.kpi .n .u { font-size: 17pt; }
.kpi .k { display: block; color: var(--muted); font-size: 11pt; margin-top: 10px; }

/* カードグリッド（アイコン+見出し+説明）: <div class="card-grid"> */
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0; }
.card-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.card {
  background: #fff; border: 1px solid var(--line); border-radius: 14px;
  padding: 20px 20px 18px;
  box-shadow: 0 2px 4px rgba(var(--shadow),.04), 0 10px 24px rgba(var(--shadow),.07);
}
.card .icon {
  width: 48px; height: 48px; border-radius: 13px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 22pt; margin-bottom: 14px; box-shadow: 0 5px 12px rgba(0,150,214,.28);
}
.card h3 { margin: 0 0 6px; color: var(--brand); font-size: 13pt; }
.card p { margin: 0; color: var(--ink); font-size: 10.5pt; line-height: 1.6; }

/* 番号バッジ付きリスト: <div class="steps"> 内の .step */
.step { display: flex; gap: 14px; align-items: flex-start; margin: 0 0 16px; }
.step .num {
  flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent) 0%, var(--brand) 100%);
  color: #fff; font-weight: 800;
  display: flex; align-items: center; justify-content: center; font-size: 13pt;
  box-shadow: 0 4px 10px rgba(0,150,214,.28);
}
.step .body h3 { margin: 2px 0 4px; }
.step .body p { margin: 0; color: var(--muted); font-size: 10.5pt; }

/* before/after など2カラム: <div class="cols"> */
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 10px 0; }
.cols .col {
  border: 1px solid var(--line); border-radius: 12px; padding: 18px;
  box-shadow: 0 1px 3px rgba(var(--shadow),.05);
}
.cols .col h3 { margin: 0 0 10px; font-size: 13pt; }
.cols .col.before { background: #fafafa; }
.cols .col.before h3 { color: var(--muted); }
.cols .col.after { background: var(--tint); border-color: var(--accent); box-shadow: 0 4px 14px rgba(0,150,214,.12); }
.cols .col.after h3 { color: var(--brand); }

/* コールアウト: <div class="callout"> */
.callout {
  background: var(--tint); border-left: 5px solid var(--accent);
  border-radius: 10px; padding: 16px 20px; margin: 14px 0;
  box-shadow: 0 1px 3px rgba(var(--shadow),.05);
}

/* ロゴウォール（導入企業）: <div class="logos"> 内にセル（直下要素、ロゴ画像 or 社名）。
   列数変種 .cols-3 / .cols-5、任意キャプション .logos-note */
.logos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 16px 0; }
.logos.cols-3 { grid-template-columns: repeat(3, 1fr); }
.logos.cols-5 { grid-template-columns: repeat(5, 1fr); }
.logos > * {
  background: #fff; border: 1px solid var(--line); border-radius: 10px; height: 72px;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted); font-size: 10.5pt; font-weight: 700; letter-spacing: .04em;
  box-shadow: 0 2px 5px rgba(var(--shadow),.05);
}
.logos > * img { max-width: 78%; max-height: 60%; object-fit: contain; }
.logos-note { text-align: center; color: var(--muted); font-size: 10.5pt; margin-top: 10px; }

/* 目次: <div class="toc"> 内に .toc-item（.no 番号 / .ttl 見出し / .pg ページ番号、.pg は任意）*/
.toc { margin: 18px 0; }
.toc-item {
  display: flex; align-items: center; gap: 20px;
  padding: 17px 6px; border-bottom: 1px solid var(--line);
}
.toc-item:last-child { border-bottom: none; }
.toc-item .no {
  flex: 0 0 auto; min-width: 50px; font-size: 23pt; font-weight: 800; line-height: 1;
  color: var(--brand);
  background: linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.toc-item .ttl { flex: 1 1 auto; font-size: 14pt; font-weight: 700; color: var(--ink); }
.toc-item .pg { flex: 0 0 auto; color: var(--muted); font-size: 11pt; font-weight: 700; letter-spacing: .05em; }

/* 導入事例カード: <div class="case"> （.case-head 企業ヘッダー / .case-body 課題→施策→効果 / .case-quote 顧客の声）
   ロゴは "LOGO" プレースホルダ。実ロゴ埋込はライセンス/商標の都合で利用者に委ねる */
.case {
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
  box-shadow: 0 10px 24px rgba(var(--shadow),.07); margin: 16px 0;
}
.case-head {
  display: flex; align-items: center; gap: 16px; padding: 18px 22px;
  background: linear-gradient(135deg, var(--brand) 0%, #122a52 100%); color: #fff;
}
.case-head .logo {
  flex: 0 0 auto; width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,.15);
  display: flex; align-items: center; justify-content: center; font-size: 9.5pt; font-weight: 700; color: #fff;
}
.case-head .company { display: block; font-size: 15pt; font-weight: 800; }
.case-head .industry { display: block; font-size: 10.5pt; color: #cfe2f6; margin-top: 2px; }
.case-body { padding: 20px 22px; }
.case-row { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
.case-row:last-child { margin-bottom: 0; }
.case-row .label {
  flex: 0 0 auto; width: 56px; text-align: center; padding: 5px 0; border-radius: 6px;
  font-size: 10pt; font-weight: 800; background: var(--tint); color: var(--brand);
}
.case-row.result .label { background: var(--accent); color: #fff; }
.case-row p { margin: 0; font-size: 11.5pt; line-height: 1.65; }
.case-row.result p strong { color: var(--accent); font-size: 13pt; }
.case-quote {
  margin: 0; padding: 16px 22px; background: var(--tint); border-top: 1px solid var(--line);
  font-style: italic; color: var(--brand); font-size: 12pt; border-left: none;
}
.case-quote cite { display: block; font-style: normal; color: var(--muted); font-size: 10pt; margin-top: 6px; }

/* CTA: _class: cta */
section.cta { background: var(--tint); display: flex; flex-direction: column; justify-content: center; }
section.cta h1 { font-size: 26pt; }
.cta-box {
  background: linear-gradient(135deg, var(--brand) 0%, #122a52 100%); color: #fff;
  border-radius: 14px; padding: 28px 32px; margin: 18px 0;
  box-shadow: 0 12px 28px rgba(var(--shadow),.18);
}
.cta-box h3 { color: #fff; margin: 0 0 8px; font-size: 16pt; }
.cta-box .btn {
  display: inline-block; background: var(--accent); color: #fff; font-weight: 700;
  padding: 10px 22px; border-radius: 8px; margin-top: 12px;
  box-shadow: 0 6px 14px rgba(0,150,214,.35);
}
`
