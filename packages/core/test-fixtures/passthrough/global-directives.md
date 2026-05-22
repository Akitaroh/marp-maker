---
marp: true
theme: whitepaper-a4
size: A4
paginate: true
header: '**Global Header** | MarpMaker'
footer: 'Confidential — All rights reserved'
style: |
  section {
    background: #fafafa;
  }
  h1 {
    color: #cc6600;
  }
---

# Global Directives Test — Page 1

このフィクスチャは frontmatter の global directives 検証用:

- `header:` グローバル header
- `footer:` グローバル footer
- `style:` インライン CSS 注入

A2 / 検証点:
- `<header>` / `<footer>` が全ページに表示されるか
- `style:` の CSS が反映されるか（h1 がオレンジ、背景がライトグレー）

---

# Page 2 — 継承確認

このページにも global header / footer / style が継承されているはず。

オレンジ h1 / ライトグレー背景 / 全ページに固定 header/footer。
