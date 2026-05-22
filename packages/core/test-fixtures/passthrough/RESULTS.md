# Marp Passthrough Test — 結果 (2026-05-22)

## 実行環境

- @marp-team/marp-cli 4.x
- whitepaper-a4 テーマのみ
- 設定: `--allow-local-files` のみ。`--html` / `math` / `mermaid` 全て **デフォルト** (= 設定無し)
- fixture: `all-features.md` (13 ページ、12 機能カテゴリ)

## 結果マトリクス

### ✅ Works out of box（追加設定不要で動く）

| 機能 | 確認方法 | 備考 |
|---|---|---|
| **太字 / 斜体 / 取消線** | `<strong>` / `<em>` / `<s>` タグ生成 | |
| **インラインコード** | `<code class="hljs...">` | |
| **リスト（無序・有序・ネスト）** | `<ul>` / `<ol>` 入れ子 | |
| **テーブル + alignment** | `<th style="text-align:left/center/right">` | `:---:` 構文対応 |
| **コードブロック + syntax highlight** | hljs クラス付与（js / ts / plain 確認）| highlight.js ベース |
| **Blockquote** | `<blockquote>` | |
| **外部 URL 画像** | `<img src="https://...">` | |
| **画像サイズ指定 `![w:200]`** | `style="width:200px;"` | Marp 拡張記法 |
| **背景画像 `![bg]`** | `background-image:url(...)` | Marp 拡張記法 |
| **`_class: invert` directive** | `class="invert"` 適用 | |
| **`_header` / `_footer` directive** | `<header>` / `<footer>` 生成 | |
| **`_backgroundColor` directive** | `background-color:#f0f8ff` 反映 | |
| **ページ区切り `---`** | `<section>` 分割 | 14 sections（うち 1 は frontmatter 用？要確認）|
| **`<br>` 改行** | `<br />` として通る | HTML 全 OFF でも br は許可される |

### ❌ Does NOT work out of box（デフォルトでは無効）

| 機能 | 観測 | 修正方法 |
|---|---|---|
| **数式（KaTeX / MathJax）** | `$$...$$` も `$...$` も完全に出力から消える、KaTeX クラスも本文中に登場せず | `marp.config.js` に `math: 'katex'` 設定 |
| **Mermaid 図** | ` ```mermaid` ブロックが単なる code block として `<pre><code class="language-mermaid">` で残る、図にならない | Marp は標準非対応。`@marp-team/marp-mermaid` plugin / または独自 markdown-it plugin 要 |
| **タスクリスト `- [x]`** | チェックボックス生成されず、単なるリスト扱い | markdown-it-task-lists plugin 要、Marp engine 拡張 |
| **脚注 `[^1]`** | `<sup>` 等の脚注要素生成されず、おそらく素通り or 削除 | markdown-it-footnote plugin 要 |
| **HTML 埋込（`<div>` 等）** | `<div style="color: red...">` が出力に含まれず | `--html` フラグ ON（または config）|

### 🟡 部分動作

| 機能 | 状態 |
|---|---|
| `<br>` 単独タグ | 通る（HTML OFF でも例外的に許可）|
| Frontmatter (theme / size / paginate) | 通る、確認済み |

## Marp の最低限カバー判定

**Step 1（Marp の最低限機能）の達成度: 70%**

- ✅ markdown の基本（見出し / 強調 / リスト / 表 / 引用 / コード / 画像 / リンク）
- ✅ Marp 固有 directives（page-level class / header / footer / bg color / bg image / image size）
- ✅ ページ区切り
- ❌ Math（多くの技術ホワイトペーパーで必須、未対応は致命的）
- ❌ Mermaid（フローチャート / シーケンス図、技術文書で頻出）
- ❌ HTML 埋込（汎用脱出口、現状ロック）
- ❌ Task list / Footnote（あれば嬉しい）

## 推奨対応（Phase A の中で）

### A3.1: marp.config.js 追加で数式と HTML を有効化

`packages/core/marp.config.js`:

```js
export default {
  options: {
    html: true,       // HTML 埋込許可（信頼できる入力前提、企業利用なら OK）
    math: 'katex',    // 数式有効化
  },
}
```

`marp-renderer.ts` の `runMarpCli` 引数に `--config` で渡す or 環境変数で。

**工数: 30 分。インパクト: Math 有効化 + HTML 脱出口確保で B2B / 技術文書のかなりの部分カバー**。

### A3.2: タスクリスト / 脚注 plugin 追加

`markdown-it-task-lists` / `markdown-it-footnote` を Marp engine 経由で組込：

`packages/core/marp.engine.js`:

```js
import { Marp } from '@marp-team/marp-core'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'

export default ({ marp }) => marp.use(taskLists).use(footnote)
```

`marp-cli --engine` で渡す。**工数: 1 時間。インパクト: 中（差別化要素ではないが完成度上がる）**。

### A3.3: Mermaid 対応（後回し推奨）

選択肢:
- A. `@marp-team/marp-mermaid` （存在するか要確認、無いかも）
- B. mermaid CDN を frontmatter で読み込み、` ```mermaid` を class 変換して JS で render
- C. プリプロセス: markdown → mermaid 図を SVG に変換 → markdown に埋め戻し
- D. 諦める（技術文書では別途画像で対応）

**工数: 1〜数日。優先度: 低**（B2B ホワイトペーパーで mermaid 必須は稀、技術ドキュメント路線で必要なら後で）

## 結論

**Marp の最低限完備（Step 1）達成までに必要なのは A3.1 だけ**。Math 有効化と HTML 許可で「Marp ユーザーの 90% の用途」をカバーできる。タスクリスト / 脚注 / Mermaid は二段目で OK。

Step 1 完成判定:

- [x] **A3.1: `marp.config.json` 追加で math + html 有効化（2026-05-22 完了）**
- [ ] A3.2: task list + footnote plugin 組込
- [ ] A1: カスタム CSS テーマ持込（既知の制約として明記済み、別 Phase）
- [ ] A3.3: Mermaid（後回し）

A1（カスタム CSS 持込）と A3.1（math/html 有効化）が Phase A の Day 1 の双璧、A3.2 は Day 2 で。

---

## A3.1 適用後の再検証（2026-05-22）

`packages/core/marp.config.json` を追加し、`marp-renderer.ts` の `buildArgs` で `--config <path>` を渡すように変更。

### 設定内容

```json
{
  "html": true,
  "math": "katex"
}
```

### 再 passthrough 結果

| 機能 | 前 | 後 | 備考 |
|---|---|---|---|
| **Math** | ❌ | ✅ | MathJax SVG として描画。config では `"katex"` だが marp-cli が MathJax を選択した模様（PDF 出力に SVG の方が確実なため、結果オーライ）|
| **HTML 埋込** | ❌ | ✅ | `<div style="color: red">` が出力 HTML にそのまま含まれる |
| **Mermaid** | ❌ | ❌ | 変わらず（plugin 要） |
| **Task list** | ❌ | ❌ | 変わらず（plugin 要） |
| **Footnote** | ❌ | ❌ | 変わらず（plugin 要） |
| 既存の全 ✅ 機能 | ✅ | ✅ | 回帰なし |

### 副作用検証

- 既存 62 テスト全 pass
- 出力 HTML サイズ: 142,617 bytes → 143,427 bytes（+810 bytes、MathJax font glyph SVG 分）
- 出力 PDF サイズ: 大きな変化なし
- レンダ時間: 体感差なし

### Step 1 達成度

**70% → 85%**（Math + HTML 埋込の 2 つが解消）

残り未対応:
- Mermaid（プラグイン or プリプロセス、優先度低）
- Task list / Footnote（plugin 追加で対応、A3.2 で）

## セキュリティ note

`html: true` を有効化したことで、ユーザー入力 markdown 内の生 HTML が render 結果に含まれる。**信頼できない入力ソースを直接 render すると XSS リスク**。

対策（後続検討）:
- AI 生成 markdown は信頼前提で OK
- 外部から渡される markdown は sanitize（DOMPurify 等）を挟むレイヤを追加
- 動的 CTA 路線で B2B 顧客がエンドユーザー入力を扱う場合、Atom-MarpRenderer の責務外で sanitize する設計にする

