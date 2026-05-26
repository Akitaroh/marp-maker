import { describe, it, expect } from 'vitest'
import {
  parseThemeName,
  toThemeEntries,
  availableThemeNames,
} from './theme-registry'

describe('parseThemeName', () => {
  it('/* @theme name */ を抽出', () => {
    expect(parseThemeName('/* @theme mybrand */\nsection{}')).toBe('mybrand')
  })
  it('スペース揺れも許容', () => {
    expect(parseThemeName('/*   @theme   whitepaper-a4   */')).toBe('whitepaper-a4')
  })
  it('@theme 無しは null', () => {
    expect(parseThemeName('section{ color:red }')).toBe(null)
  })
})

describe('toThemeEntries', () => {
  it('@theme 名が取れた css だけ採用', () => {
    const entries = toThemeEntries([
      '/* @theme a */\nx',
      'no theme here',
      '/* @theme b */\ny',
    ])
    expect(entries.map((e) => e.name)).toEqual(['a', 'b'])
  })
})

describe('availableThemeNames', () => {
  it('バンドル(whitepaper-a4/oyakudachi/whitepaper-pro/monochrome/profile) + 組込 + カスタム（重複除去）', () => {
    const names = availableThemeNames([
      { name: 'mybrand', css: '/* @theme mybrand */' },
    ])
    expect(names).toEqual([
      'whitepaper-a4',
      'oyakudachi',
      'whitepaper-pro',
      'monochrome',
      'profile',
      'default',
      'gaia',
      'uncover',
      'mybrand',
    ])
  })
  it('カスタムが組込名と被っても重複しない', () => {
    const names = availableThemeNames([{ name: 'gaia', css: '/* @theme gaia */' }])
    expect(names.filter((n) => n === 'gaia')).toHaveLength(1)
  })
})
