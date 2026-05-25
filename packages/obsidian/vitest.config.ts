import { defineConfig } from 'vitest/config'
import path from 'node:path'

// obsidian は実体が Obsidian アプリ側にあるため、テストでは最小スタブに alias する。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'test/__mocks__/obsidian.ts'),
    },
  },
})
