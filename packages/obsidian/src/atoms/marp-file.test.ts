import { describe, it, expect } from 'vitest'
import { hasMarpFrontmatter } from './marp-file'

describe('hasMarpFrontmatter', () => {
  it('marp: true → true', () => {
    expect(hasMarpFrontmatter({ marp: true })).toBe(true)
  })
  it('marp 不在 → false', () => {
    expect(hasMarpFrontmatter({})).toBe(false)
  })
  it('marp: false → false', () => {
    expect(hasMarpFrontmatter({ marp: false })).toBe(false)
  })
  it('undefined / null → false', () => {
    expect(hasMarpFrontmatter(undefined)).toBe(false)
    expect(hasMarpFrontmatter(null)).toBe(false)
  })
  it('truthy だが true でない値（文字列 "true"）→ false', () => {
    expect(hasMarpFrontmatter({ marp: 'true' })).toBe(false)
  })
})
