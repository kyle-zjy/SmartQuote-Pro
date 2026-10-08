import { describe, expect, it } from 'vitest'
import { isValidQuoteNumber } from './quoteNumberValidation'

describe('isValidQuoteNumber', () => {
  it('accepts a plain numeric quote number', () => {
    expect(isValidQuoteNumber('33021')).toBe(true)
  })

  it('accepts standard English letters mixed with numbers', () => {
    expect(isValidQuoteNumber('A123')).toBe(true)
    expect(isValidQuoteNumber('Q33021')).toBe(true)
    expect(isValidQuoteNumber('QUOTE2026')).toBe(true)
  })

  it('accepts a quote number made entirely of letters', () => {
    expect(isValidQuoteNumber('ABCDEF')).toBe(true)
  })

  it('accepts the hyphen, underscore, and period separators', () => {
    expect(isValidQuoteNumber('Q-2026-001')).toBe(true)
    expect(isValidQuoteNumber('INV_2026_01')).toBe(true)
    expect(isValidQuoteNumber('33021.1')).toBe(true)
    expect(isValidQuoteNumber('---___...')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidQuoteNumber('')).toBe(false)
  })

  it('rejects whitespace', () => {
    expect(isValidQuoteNumber('33021 ')).toBe(false)
    expect(isValidQuoteNumber('33 021')).toBe(false)
  })

  it('rejects characters that are unsafe as a URL path segment', () => {
    expect(isValidQuoteNumber('33021/1')).toBe(false)
    expect(isValidQuoteNumber('33021?x=1')).toBe(false)
    expect(isValidQuoteNumber('33021#1')).toBe(false)
    expect(isValidQuoteNumber('33021%20')).toBe(false)
    expect(isValidQuoteNumber('33021\\1')).toBe(false)
  })

  it('rejects other punctuation outside the supported separator set', () => {
    expect(isValidQuoteNumber("Q'21")).toBe(false)
    expect(isValidQuoteNumber('Q(2026)')).toBe(false)
    expect(isValidQuoteNumber('Q&2026')).toBe(false)
  })

  it('rejects non-English characters', () => {
    expect(isValidQuoteNumber('33021é')).toBe(false)
  })

  it('rejects a value longer than 50 characters', () => {
    expect(isValidQuoteNumber('A'.repeat(51))).toBe(false)
  })

  it('accepts a value exactly 50 characters long', () => {
    expect(isValidQuoteNumber('A'.repeat(50))).toBe(true)
  })
})
