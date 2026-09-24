import { describe, expect, it } from 'vitest'
import { displayQuoteNo, displayQuoteRevision } from './displayQuoteNo'

describe('displayQuoteNo', () => {
  it('shows the entered quote number alone, trimmed', () => {
    expect(displayQuoteNo('00033012', 'A-4521')).toBe('A-4521')
    expect(displayQuoteNo('00033012', ' 4521 ')).toBe('4521')
  })

  it('falls back to the internal quote number when none was entered', () => {
    expect(displayQuoteNo('00033011', '')).toBe('00033011')
  })
})

describe('displayQuoteRevision', () => {
  it('labels revisions from version 1', () => {
    expect(displayQuoteRevision(1)).toBe('Rev 1')
    expect(displayQuoteRevision(3)).toBe('Rev 3')
  })
})
