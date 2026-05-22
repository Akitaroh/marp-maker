/**
 * ZDD Atom: Atom-ThemeData バリデーションのテスト。
 *
 * 検証経路は設計 doc 参照:
 * 50_Mission/zddmission/MarpMaker/Atom-ThemeData.md "検証経路" セクション
 */

import { describe, it, expect } from 'vitest'
import {
  isValidThemeData,
  assertValidThemeData,
  ThemeDataValidationError,
} from './theme-validator'

const validCss = `
/* @theme whitepaper-a4 */
/* @size A4 793px 1122px */
@import 'default';

section {
  width: 793px;
  height: 1122px;
  padding: 60px;
}
`

const validTheme = {
  id: 'whitepaper-a4',
  cssContent: validCss,
  size: { name: 'A4', width: 793, height: 1122 },
}

describe('isValidThemeData', () => {
  it('returns true for valid ThemeData', () => {
    expect(isValidThemeData(validTheme)).toBe(true)
  })

  it('returns false for null or non-object', () => {
    expect(isValidThemeData(null)).toBe(false)
    expect(isValidThemeData(undefined)).toBe(false)
    expect(isValidThemeData('string')).toBe(false)
    expect(isValidThemeData(42)).toBe(false)
    expect(isValidThemeData([])).toBe(false)
  })

  it('returns false for invalid id (empty string)', () => {
    expect(isValidThemeData({ ...validTheme, id: '' })).toBe(false)
  })

  it('returns false for invalid id (uppercase)', () => {
    expect(
      isValidThemeData({ ...validTheme, id: 'WhitepaperA4' })
    ).toBe(false)
  })

  it('returns false for invalid id (special chars)', () => {
    expect(isValidThemeData({ ...validTheme, id: 'theme/a4' })).toBe(false)
  })

  it('returns false for empty cssContent', () => {
    expect(isValidThemeData({ ...validTheme, cssContent: '' })).toBe(false)
  })

  it('returns false when @theme name does not match id', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        cssContent: validCss.replace('whitepaper-a4', 'other-theme'),
      })
    ).toBe(false)
  })

  it('returns false for negative width', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        size: { ...validTheme.size, width: -1 },
      })
    ).toBe(false)
  })

  it('returns false for non-integer dimensions', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        size: { ...validTheme.size, width: 1.5 },
      })
    ).toBe(false)
  })

  it('returns false for zero dimensions', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        size: { ...validTheme.size, width: 0 },
      })
    ).toBe(false)
  })

  it('returns false when @size width does not match size.width', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        size: { ...validTheme.size, width: 800 },
      })
    ).toBe(false)
  })

  it('returns false when @theme metadata is missing', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        cssContent: '/* @size A4 793px 1122px */ section { width: 793px; }',
      })
    ).toBe(false)
  })

  it('returns false when @size metadata is missing', () => {
    expect(
      isValidThemeData({
        ...validTheme,
        cssContent: '/* @theme whitepaper-a4 */ section { width: 793px; }',
      })
    ).toBe(false)
  })
})

describe('assertValidThemeData', () => {
  it('does not throw for valid ThemeData', () => {
    expect(() => assertValidThemeData(validTheme)).not.toThrow()
  })

  it('throws ThemeDataValidationError with kind=invalid-id for bad id', () => {
    try {
      assertValidThemeData({ ...validTheme, id: 'BadId' })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      const err = e as ThemeDataValidationError
      expect(err.kind).toBe('invalid-id')
      expect(err.field).toBe('id')
    }
  })

  it('throws metadata-mismatch for @theme name mismatch', () => {
    try {
      assertValidThemeData({
        ...validTheme,
        cssContent: validCss.replace('whitepaper-a4', 'other-theme'),
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      const err = e as ThemeDataValidationError
      expect(err.kind).toBe('metadata-mismatch')
      expect(err.field).toBe('cssContent.@theme')
    }
  })

  it('throws invalid-size for negative dimensions', () => {
    try {
      assertValidThemeData({
        ...validTheme,
        size: { name: 'A4', width: -10, height: 1122 },
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      const err = e as ThemeDataValidationError
      expect(err.kind).toBe('invalid-size')
      expect(err.field).toBe('size')
    }
  })

  it('throws invalid-css for missing @theme metadata', () => {
    try {
      assertValidThemeData({
        ...validTheme,
        cssContent: 'section { width: 793px; }',
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      const err = e as ThemeDataValidationError
      expect(err.kind).toBe('invalid-css')
    }
  })

  it('throws metadata-mismatch when @size width does not match', () => {
    try {
      assertValidThemeData({
        ...validTheme,
        size: { name: 'A4', width: 800, height: 1122 },
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      const err = e as ThemeDataValidationError
      expect(err.kind).toBe('metadata-mismatch')
      expect(err.field).toBe('cssContent.@size.width')
    }
  })

  it('throws invalid-id for null input', () => {
    try {
      assertValidThemeData(null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeDataValidationError)
      expect((e as ThemeDataValidationError).field).toBe('root')
    }
  })
})
