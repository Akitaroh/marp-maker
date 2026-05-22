/**
 * Marp 設定 + engine プラグイン組込。
 *
 * A3.1 (2026-05-22): html / math 有効化
 * A3.2 (2026-05-22): markdown-it-task-lists + markdown-it-footnote を engine 経由で追加
 *
 * 設計 doc: 50_Mission/zddmission/MarpMaker/Atom-MarpRenderer.md
 */

import markdownItTaskLists from 'markdown-it-task-lists'
import markdownItFootnote from 'markdown-it-footnote'

export default {
  html: true,
  math: 'katex',
  engine: ({ marp }) => marp.use(markdownItTaskLists).use(markdownItFootnote),
}
