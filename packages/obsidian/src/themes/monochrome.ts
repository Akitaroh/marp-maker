/**
 * monochrome — モダン・ミニマリスト B2B 資料テーマ（A4 縦）。
 * theme-factory「Modern Minimalist」パレット（charcoal/slate/light-gray）由来。
 * oyakudachi（紺・グラデ）/ whitepaper-pro（紺+ティール・塗り帯）と別系統＝無彩色フラット。
 * 設計言語: 塗り帯/グラデ/影を排し、1px ヘアライン + 余白で構成（Swiss/editorial 寄り）。
 * `:::` 記法（Atom-MarpContainers）は共通＝同じ deck を theme 切替だけで再スキンできる。
 * 設計: Atom-MonochromeTheme.md
 */
export const MONOCHROME_THEME_NAME = 'monochrome'

export const MONOCHROME_CSS = `/* @theme monochrome */
/* @size A4 793px 1122px */
@import 'default';

:root {
  --brand: #36454f;   /* charcoal（主役）*/
  --accent: #5b6b78;  /* slate（#708090 をやや締めた）*/
  --ink: #2b3138;     /* 本文 */
  --muted: #8a95a0;   /* 補助テキスト */
  --line: #e4e8eb;    /* ヘアライン罫線 */
  --fill: #f3f5f6;    /* 淡グレー塗り（プレースホルダ/コールアウト）*/
  --pad: 60px;        /* 余白多め（ミニマル）*/
  /* 固定レイアウトグリッド（本文系で全ページ共通＝header/タイトル/罫線/メイン上端を固定）*/
  --g-eyebrow-top: 44px;     /* eyebrow の固定トップ */
  --g-title-baseline: 144px; /* タイトル下端の固定 Y（罫線直上・上方向に伸びる＝1/2行とも罫線にスナップ）*/
  --g-rule-y: 156px;         /* 見出し下ヘアラインの固定 Y */
  --g-main-top: 178px;       /* メイン領域の固定上端（罫線直下）*/
  --g-main-bottom: 104px;    /* メイン領域の固定下端（フッター分を確保）*/
}

section {
  width: 793px; height: 1122px; padding: var(--pad);
  background: #fff; color: var(--ink); position: relative; display: block;  /* 既定の flex中央寄せ解除 */
  font-family: 'Hiragino Sans','Noto Sans JP',sans-serif; font-size: 12pt; line-height: 1.85;
}
section h1 { color: var(--brand); font-size: 25pt; font-weight: 700; margin: 0 0 18px; letter-spacing: .01em; }
section h2 { color: var(--brand); font-size: 21pt; font-weight: 700; line-height: 1.35; margin: 0 0 16px; }
section h3 { color: var(--brand); font-size: 13.5pt; font-weight: 700; margin: 18px 0 8px; }
section p { margin: 0 0 12px; }
section ul, section ol { margin: 0 0 14px; padding-left: 1.25em; }
section li { margin-bottom: 7px; }
section li::marker { color: var(--accent); }
section strong { color: var(--brand); }
section a { color: var(--accent); }
section blockquote { border-left: 2px solid var(--accent); padding: 2px 0 2px 16px; margin: 14px 0; color: var(--muted); }
section code { background: var(--fill); color: var(--brand); padding: 2px 7px; border-radius: 3px; font-family: 'SF Mono',Consolas,monospace; font-size: 10.5pt; }
section pre { background: #2b3138; color: #e7ebee; padding: 16px; border-radius: 4px; overflow-x: auto; }
section pre code { background: transparent; color: inherit; }

/* 表（ミニマル: 横罫のみ・塗り無し・角丸無し。marp 既定 GFM の display:block;width:max-content を後勝ちで上書き）*/
section table { display: table; width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11pt; }
section table th, section table td { border: none; border-bottom: 1px solid var(--line); padding: 11px 14px; text-align: left; vertical-align: top; }
section table thead th { border-bottom: 2px solid var(--brand); color: var(--brand); font-weight: 700; background: none; }

/* ===== 本文系スライド: 固定レイアウトグリッド =====
   全ページで ①eyebrow位置 ②メイン上端 を固定し、③メイン領域は flex 縦センタで
   上下余白を均等にする。eyebrow/タイトル/ヘアラインは absolute で固定ゾーン化し、
   フロー対象を本文だけにする → justify-content:center が本文だけを均等配置する。*/
section:not(.cover):not(.chapter):not(.cta):not(.lead) {
  display: flex; flex-direction: column; justify-content: safe center;  /* 収まる時は中央=上下余白均等／溢れる時は上揃え（ヘッダーゾーンに被らない）*/
  padding-top: var(--g-main-top);       /* メイン上端を固定（ヘッダーゾーン確保）*/
  padding-bottom: var(--g-main-bottom);  /* メイン下端を固定（フッター確保）*/
}
/* eyebrow（header ディレクティブ）: 固定トップ */
section:not(.cover):not(.chapter):not(.cta):not(.lead) > header {
  position: absolute; top: var(--g-eyebrow-top); left: var(--pad); right: var(--pad);
  margin: 0; padding: 0;
  color: var(--accent); font-weight: 700; font-size: 10pt; letter-spacing: .14em; text-transform: uppercase;
}
/* タイトル: 固定ヘアラインの直上にボトムアンカー（1行でも2行でも罫線にスナップ、2行は上へ伸びる）*/
section:not(.cover):not(.chapter):not(.cta):not(.lead) > h2 {
  position: absolute; bottom: calc(100% - var(--g-title-baseline)); left: var(--pad); right: var(--pad);
  margin: 0; padding: 0;
}
/* 見出し下ヘアライン: 固定 Y（タイトル行数に依存しない）*/
section:not(.cover):not(.chapter):not(.cta):not(.lead)::before {
  content: ''; position: absolute; left: var(--pad); right: var(--pad); top: var(--g-rule-y);
  border-top: 1px solid var(--line);
}
/* 本文先頭の上マージンを消す（中央寄せのバランスを崩さない）*/
section:not(.cover):not(.chapter):not(.cta):not(.lead) > h2 + * { margin-top: 0; }

/* ===== フッター: 会社名(左) | CTA(.foot-cta 中央) | ページ番号(右) ===== */
section footer {
  position: absolute; left: var(--pad); right: var(--pad); bottom: 28px;
  display: flex; align-items: center; font-size: 9pt; color: var(--muted);
  border-top: 1px solid var(--line); padding-top: 12px; letter-spacing: .08em;
}
section footer .foot-cta { margin: 0 auto; color: var(--brand); font-weight: 700; letter-spacing: 0; }
section::after { color: var(--muted); font-size: 9pt; bottom: 28px; right: var(--pad); }

/* ===== 番号ポイント（:::step）: 大きいフラット番号 + 見出し + 本文 ===== */
.step { display: flex; gap: 18px; align-items: baseline; margin: 0 0 26px; }
.step .num { flex: 0 0 auto; min-width: 34px; color: var(--accent); font-size: 22pt; font-weight: 300; line-height: 1; }
.step .body { flex: 1 1 auto; }
.step .body h3 { margin: 0 0 4px; color: var(--brand); font-size: 13.5pt; }
.step .body p { margin: 0; color: var(--ink); }

/* 2カラム（:::cols/:::col）: 枠なしプレーン（テキスト | 図）*/
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: center; margin: 8px 0 0; }
.col { padding: 0; border: 0; background: none; font-size: 11pt; color: var(--ink); line-height: 1.9; }

/* 画像プレースホルダ（:::imgbox）: 細枠 + 中央ラベル */
.imgbox { background: var(--fill); border: 1px solid var(--line); border-radius: 2px; min-height: 150px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-weight: 700; letter-spacing: .12em; font-size: 10.5pt; }
.imgbox img { width: 100%; height: auto; border-radius: 2px; }

/* コールアウト（左罫 + 淡塗り）*/
.callout { background: var(--fill); border-left: 2px solid var(--brand); border-radius: 0 3px 3px 0; padding: 14px 18px; margin: 14px 0; }

/* ===== カードグリッド（フラット: 1px枠・影なし・四角）===== */
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0; }
.card-grid.cols-3 { grid-template-columns: repeat(3,1fr); }
.card { background: #fff; border: 1px solid var(--line); border-radius: 3px; padding: 22px 20px; }
.card .icon { width: 44px; height: 44px; border-radius: 3px; background: var(--brand); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20pt; margin-bottom: 14px; }
.card h3 { margin: 0 0 6px; color: var(--brand); font-size: 13pt; }
.card p { margin: 0; color: var(--ink); font-size: 10.5pt; line-height: 1.65; }

/* ===== 数字強調（フラット・グラデ無し）===== */
.stat { text-align: center; margin: 24px 0; padding: 32px 24px; background: var(--fill); border: 1px solid var(--line); border-radius: 4px; }
.stat .big { display: block; font-size: 72pt; font-weight: 800; line-height: 1; color: var(--brand); }
.stat .unit { font-size: 28pt; color: var(--accent); }
.stat .label { display: block; color: var(--muted); font-size: 13pt; margin-top: 12px; }

/* ドーナツ%（charcoal リング on 淡グレートラック）*/
.donut { --val: 50; --size: 148px; width: var(--size); height: var(--size); border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; background: conic-gradient(var(--brand) 0 calc(var(--val) * 1%), var(--line) calc(var(--val) * 1%) 100%); }
.donut::before { content: ''; position: absolute; inset: 16px; background: #fff; border-radius: 50%; }
.donut .pct { position: relative; z-index: 1; font-size: 28pt; font-weight: 800; color: var(--brand); }
.donut .pct .u { font-size: 14pt; font-weight: 700; color: var(--accent); }
.donut-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; justify-items: center; margin: 20px 0; }
.donut-row .donut-item { text-align: center; }
.donut-row .donut { margin: 0 auto 12px; }
.donut-row .cap { display: block; color: var(--muted); font-size: 10.5pt; line-height: 1.5; }

/* KPI（フラット）*/
.kpi-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin: 20px 0; }
.kpi { text-align: center; padding: 26px 14px; background: var(--fill); border: 1px solid var(--line); border-radius: 4px; }
.kpi .n { display: block; font-size: 40pt; font-weight: 800; line-height: 1; color: var(--brand); }
.kpi .n .u { font-size: 16pt; color: var(--accent); }
.kpi .k { display: block; color: var(--muted); font-size: 11pt; margin-top: 10px; }

/* 目次（:::toc / :::toc-item）*/
.toc { margin: 18px 0; }
.toc-item { display: flex; align-items: center; gap: 22px; padding: 18px 4px; border-bottom: 1px solid var(--line); }
.toc-item:last-child { border-bottom: none; }
.toc-item .no { flex: 0 0 auto; min-width: 48px; font-size: 22pt; font-weight: 300; line-height: 1; color: var(--accent); }
.toc-item .ttl { flex: 1 1 auto; font-size: 14pt; font-weight: 700; color: var(--ink); }
.toc-item .pg { flex: 0 0 auto; color: var(--muted); font-size: 11pt; font-weight: 700; letter-spacing: .05em; }

/* 導入事例（:::case）*/
.case { border: 1px solid var(--line); border-radius: 4px; overflow: hidden; margin: 16px 0; }
.case-head { display: flex; align-items: center; gap: 16px; padding: 18px 22px; background: var(--brand); color: #fff; }
.case-head .logo { flex: 0 0 auto; width: 50px; height: 50px; border-radius: 4px; background: rgba(255,255,255,.16); display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 700; color: #fff; }
.case-head .company { display: block; font-size: 15pt; font-weight: 800; }
.case-head .industry { display: block; font-size: 10.5pt; color: #c4ccd2; margin-top: 2px; }
.case-body { padding: 20px 22px; }
.case-row { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
.case-row:last-child { margin-bottom: 0; }
.case-row .label { flex: 0 0 auto; width: 56px; text-align: center; padding: 5px 0; border-radius: 3px; font-size: 10pt; font-weight: 800; background: var(--fill); color: var(--brand); }
.case-row.result .label { background: var(--brand); color: #fff; }
.case-row p { margin: 0; font-size: 11.5pt; line-height: 1.65; }
.case-row.result p strong { color: var(--brand); font-size: 13pt; }
.case-quote { margin: 0; padding: 16px 22px; background: var(--fill); border-top: 1px solid var(--line); font-style: italic; color: var(--brand); font-size: 12pt; border-left: none; }
.case-quote cite { display: block; font-style: normal; color: var(--muted); font-size: 10pt; margin-top: 6px; }

/* ロゴウォール（:::logos）: グレースケール */
.logos { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin: 16px 0; }
.logos.cols-3 { grid-template-columns: repeat(3,1fr); }
.logos.cols-5 { grid-template-columns: repeat(5,1fr); }
.logos > * { background: #fff; border: 1px solid var(--line); border-radius: 3px; height: 70px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 10.5pt; font-weight: 700; letter-spacing: .04em; }
.logos > * img { max-width: 78%; max-height: 60%; object-fit: contain; filter: grayscale(1); opacity: .82; }
.logos-note { text-align: center; color: var(--muted); font-size: 10.5pt; margin-top: 10px; }

/* ===== 全面ページ（フラット・グラデ無し）===== */
section.cover { background: var(--brand); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 76px; }
section.cover h1 { color: #fff; font-size: 32pt; line-height: 1.4; font-weight: 700; }
section.cover h1::before { content: ''; display: block; width: 52px; height: 3px; background: #fff; opacity: .9; margin-bottom: 26px; }
section.cover h2 { color: #c4ccd2; font-size: 15pt; font-weight: 400; }
section.cover strong { color: #fff; }
section.cover .meta { color: #aab4bc; font-size: 12pt; margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.2); }

section.lead { background: var(--fill); }
section.lead h1 { font-size: 27pt; }

section.chapter { background: var(--brand); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 76px; }
section.chapter .chno { color: #aeb8c0; font-size: 14pt; font-weight: 700; letter-spacing: .16em; }
section.chapter h1 { color: #fff; font-size: 31pt; margin: 12px 0 18px; font-weight: 700; }
section.chapter p { color: #c4ccd2; max-width: 80%; }

section.cta { background: var(--fill); display: flex; flex-direction: column; justify-content: center; }
section.cta h1 { font-size: 25pt; }
.cta-box { background: var(--brand); color: #fff; border-radius: 4px; padding: 30px 32px; margin: 18px 0; }
.cta-box h3 { color: #fff; margin: 0 0 8px; font-size: 16pt; }
.cta-box .btn { display: inline-block; background: #fff; color: var(--brand); font-weight: 700; padding: 10px 22px; border-radius: 3px; margin-top: 12px; }

/* 全面/特殊ページは header/footer/ページ番号を隠す */
section.cover header, section.cover footer, section.cover::after,
section.chapter header, section.chapter footer, section.chapter::after,
section.cta header, section.cta footer, section.cta::after,
section.lead header, section.lead footer { display: none; }
`
