# MarpMaker

LLM 協働でブランド完全準拠した A4 ホワイトペーパーを量産するツール。Marp を基盤に web / Obsidian plugin / MCP server の 3 形態で展開。

## Status

> 🚧 **Early MVP / Looking for feedback.** dogfood で本物の PDF 生成まで動作確認済み。コア機能の編集体験は textarea のみ、テーマ拡張・MCP 化はこれから。エンジニアレビュー歓迎。

| Milestone | Status |
|---|---|
| **M-core** (marp-engine) | ✅ Complete — 7 Atoms (theme + marp + ai + validate), 62 unit + 5 integration tests |
| **M-web** (Vercel deploy) | ✅ MVP — 4 Atoms (Editor + Preview + GenerateDialog + Export), Vite middleware で API endpoint 経由 |
| **M-plugin** (Obsidian Community Plugin) | ⬜ Planned |
| **M-mcp** (MCP server) | ⬜ Planned — 戦略上の優先度を再評価中（Skills 連携の筋が良さそう） |

### 既知の制約

- **テーマは `whitepaper-a4` 1 個固定**。カスタム CSS 持ち込み未対応 → 次の Phase A 候補
- 編集体験は **textarea のみ**。block 編集 / frontmatter UI / AI 部分再生成 は未実装
- Marp 直 passthrough（画像 / コード / Directives / Math / Mermaid）の動作網羅は未検証
- `packages/web/api/` は Vite middleware で実装、本番では Vercel Serverless Functions へ移行予定

## 設計

このリポジトリの設計は ZDD (Zettel駆動開発) で管理されている。
設計ドキュメントは別 Vault: `50_Mission/zddmission/MarpMaker/` 配下。

- HOME: `00_MarpMaker.md`
- Why / What / How: `10_Why.md` / `20_What.md` / `30_How.md`
- Atom doc: `Atom-*.md` (15 個)

## Workspace 構成

| Package | 役割 | publish 単位 |
|---|---|---|
| `packages/core/` | `@akitaroh/marp-core`、platform 非依存ロジック | npm |
| `packages/web/` | Vercel デプロイ用 web アプリ | Vercel |
| `packages/mcp/` | `@akitaroh/marp-mcp`、MCP server | npm |
| `packages/obsidian/` | Obsidian Community Plugin 開発版 | 別 repo `obsidian-marp-maker/` へ vendor copy |

## Development

```bash
pnpm install
pnpm test                                       # 全パッケージのテスト実行 (core: 62 + 5 skipped)
pnpm build                                      # 全パッケージのビルド
```

### Web アプリを起動

```bash
# 1. core ビルド（web から workspace:* で参照される）
pnpm --filter @akitaroh/marp-core build

# 2. Anthropic API キーを渡して dev server 起動
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @akitaroh/marp-maker-web dev
# → http://localhost:5173
```

API 機能を試さない場合（render / export のみ）は API キー不要：

```bash
pnpm --filter @akitaroh/marp-maker-web dev
# 別ターミナル
curl -X POST http://localhost:5173/api/render \
  -H "Content-Type: application/json" \
  -d '{"markdown":"---\ntheme: whitepaper-a4\n---\n# Hello","themeId":"whitepaper-a4"}' \
  -o /tmp/out.html && open /tmp/out.html
```

### レビュー観点（feedback 歓迎）

- 設計の妥当性: ZDD (Atom 分解) の粒度・依存方向 (`packages/web/api/` の bridge 配置等)
- prompt 設計: `packages/core/src/ai/ai-generator.ts` の system/user prompt とページ数制御
- テスト戦略: DI モック中心の単体テスト + 統合テスト (RUN_INTEGRATION=1) の使い分け
- 戦略の筋: Web UI 拡張 vs MCP/Obsidian 拡張 の優先順位（README "戦略上の優先度を再評価中" 参照）

## License

MIT
