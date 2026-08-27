import { describe, expect, it } from 'vitest'
import { displayQuoteNo, displayQuoteRevision } from './displayQuoteNo'

describe('displayQuoteNo', () => {
  it('appends a product suffix when present', () => {
    expect(displayQuoteNo('00033012', 'SS')).toBe('00033012-SS')
    expect(displayQuoteNo('00033012', ' dg ')).toBe('00033012-dg')
  })

  it('keeps the plain number when there is no suffix', () => {
    expect(displayQuoteNo('00033011', '')).toBe('00033011')
  })
})

describe('displayQuoteRevision', () => {
  it('labels revisions from version 1', () => {
    expect(displayQuoteRevision(1)).toBe('Rev 1')
    expect(displayQuoteRevision(3)).toBe('Rev 3')
  })
})
