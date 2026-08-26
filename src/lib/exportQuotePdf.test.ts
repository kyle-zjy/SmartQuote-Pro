import { describe, expect, it } from 'vitest'
import { quotePdfFilename } from './exportQuotePdf'

describe('quotePdfFilename', () => {
  it('uses the customer name when present', () => {
    expect(quotePdfFilename('00033021', 'Jane Smith')).toBe('Quote-00033021-Jane-Smith.pdf')
  })

  it('falls back when the name is empty or unsafe', () => {
    expect(quotePdfFilename('00033021', '   ')).toBe('Quote-00033021-customer.pdf')
    expect(quotePdfFilename('00033021', 'A/B:C*')).toBe('Quote-00033021-ABC.pdf')
  })
})
