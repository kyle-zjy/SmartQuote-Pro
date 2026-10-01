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

  it('rejects an empty string', () => {
    expect(isValidQuoteNumber('')).toBe(false)
  })

  it('rejects punctuation and whitespace', () => {
    expect(isValidQuoteNumber('Q-33021')).toBe(false)
    expect(isValidQuoteNumber('33021 ')).toBe(false)
    expect(isValidQuoteNumber('33 021')).toBe(false)
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
