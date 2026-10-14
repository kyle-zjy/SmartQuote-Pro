import { describe, expect, it } from 'vitest'
import { isValidQuoteNumber } from './quoteNumberValidation'

describe('isValidQuoteNumber', () => {
  it.each(['33021', 'A123', '报价 é 🐱', '33 021', 'Q/2026?x=1#%20', "Q'21(&)*", 'Q\\21', '---___...'])('accepts arbitrary characters: %s', (value) => {
    expect(isValidQuoteNumber(value)).toBe(true)
  })
  it('rejects empty or whitespace-only numbers', () => {
    expect(isValidQuoteNumber('')).toBe(false)
    expect(isValidQuoteNumber('  ')).toBe(false)
  })
  it('allows up to 50 Unicode characters after trimming', () => {
    expect(isValidQuoteNumber(' 🐱'.trim().repeat(50))).toBe(true)
    expect(isValidQuoteNumber('A'.repeat(51))).toBe(false)
    expect(isValidQuoteNumber(' 33021 ')).toBe(true)
  })
})
