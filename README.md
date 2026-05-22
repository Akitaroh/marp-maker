# MarpMaker

LLM 協働でブランド完全準拠した A4 ホワイトペーパーを量産するツール。Marp を基盤に web / Obsidian plugin / MCP server の 3 形態で展開。

## Status

> ⚠️ **Private repo during M-web development.** Will be made public once M-web milestone is complete (MVP).

| Milestone | Status |
|---|---|
| **M-core** (marp-engine) | ✅ Complete — 6 Atoms (theme + marp + ai + validate), 62 unit + 5 integration tests |
| **M-web** (Vercel deploy) | ⬜ In progress — next, MVP target |
| **M-plugin** (Obsidian Community Plugin) | ⬜ Planned |
| **M-mcp** (MCP server) | ⬜ Planned |

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
pnpm test
pnpm build
```

## License

MIT
