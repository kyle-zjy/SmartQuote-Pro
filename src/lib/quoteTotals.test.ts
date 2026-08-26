import { describe, expect, it } from 'vitest'
import { calcQuoteTotals, GST_RATE, lineAmount } from './quoteTotals'

describe('lineAmount', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineAmount(154, 2)).toBe(308)
  })

  it('does not go negative when quantity is invalid', () => {
    expect(lineAmount(154, -1)).toBe(0)
  })
})

describe('calcQuoteTotals', () => {
  const items = [
    { unitPrice: 100, quantity: 2 },
    { unitPrice: 50, quantity: 1 },
  ]

  it('applies 10% GST when enabled', () => {
    expect(calcQuoteTotals(items, true)).toEqual({
      subtotal: 250,
      gstAmount: 250 * GST_RATE,
      total: 275,
      deposit: 137.5,
      paid: 0,
      balance: 275,
    })
  })

  it('omits GST when the quote is GST-exclusive', () => {
    expect(calcQuoteTotals(items, false)).toEqual({
      subtotal: 250,
      gstAmount: 0,
      total: 250,
      deposit: 125,
      paid: 0,
      balance: 250,
    })
  })

  it('adds a non-standard colour charge before GST and takes a 50% deposit', () => {
    expect(calcQuoteTotals([{ unitPrice: 1203, quantity: 2 }], true, 220)).toEqual({
      subtotal: 2626,
      gstAmount: 262.6,
      total: 2888.6,
      deposit: 1444.3,
      paid: 0,
      balance: 2888.6,
    })
  })

  it('totals an empty quote as zero', () => {
    expect(calcQuoteTotals([], true)).toEqual({
      subtotal: 0,
      gstAmount: 0,
      total: 0,
      deposit: 0,
      paid: 0,
      balance: 0,
    })
  })

  it('reduces balance by the amount already paid', () => {
    expect(calcQuoteTotals(items, true, 0, 0.5, 100)).toMatchObject({
      total: 275,
      paid: 100,
      balance: 175,
    })
  })
})
