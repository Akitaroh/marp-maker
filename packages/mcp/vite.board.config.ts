import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// board UI を 1 HTML に焼く（marp-core + ext-apps App bridge を inline、CSP 回避）。
// root を src/board にして dist/board/marp-board.html にフラット出力する。
// NOTE: vitest がテスト探索 root を誤らないよう、ファイル名を vite.config ではなく
//       vite.board.config にして build 専用にしている（build script で --config 指定）。
const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: path.join(here, 'src/board'),
  plugins: [viteSingleFile()],
  build: {
    outDir: path.join(here, 'dist/board'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.join(here, 'src/board/marp-board.html'),
    },
  },
})
