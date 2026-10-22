import { describe, expect, it } from 'vitest'
import { calcQuoteTotals } from './quoteTotals'
import { isValidQuoteDiscount } from './quoteDiscount'
import { buildDuplicatedQuote, normalizeQuote, quoteReducer } from './quoteContext'
import { createIssuedSnapshot, quoteFinancials } from './quoteLifecycle'
import { canIssueReviewedQuote, quoteReviewContent, submitQuoteForReview } from './quoteReview'
import { decideReview } from './reviewStore'
import { MemoryStorage } from '../test/memoryStorage'

const terms = { colourExtra: 50, depositRate: 0.5 }
const draft = () => normalizeQuote({
  quoteNo: 'DISCOUNT-77', customer: { name: 'Ada', address: '1 Site St', phone: '' },
  items: [{ id: '1', description: 'Door with extras', room: 'Entry', detail: '', note: '', quantity: 2, unitPrice: 450, finalPrice: 500 }],
  discount: { percent: 10, note: 'Defence discount' }, paid: 100,
})

describe('percentage discount before GST', () => {
  it('discounts final line prices and colour charges before GST, deposit and payment balance', () => {
    const quote = draft()
    expect(quoteFinancials(quote, terms)).toMatchObject({
      subtotalBeforeDiscount: 1050, discountAmount: 105, subtotal: 945,
      gstAmount: 94.5, total: 1039.5, deposit: 519.75, paid: 100, balance: 939.5,
    })
    expect(quote.items[0].finalPrice).toBe(500)
  })

  it('rounds the discount to cents before subtracting it and then rounds GST', () => {
    expect(calcQuoteTotals([{ unitPrice: 19.99, quantity: 3 }], true, 0, 0.5, 0, 12.5)).toMatchObject({
      subtotalBeforeDiscount: 59.97, discountAmount: 7.5, subtotal: 52.47,
      gstAmount: 5.25, total: 57.72, deposit: 28.86,
    })
  })

  it('handles 0%, 100%, no GST, empty quotes and overpayment', () => {
    const items = [{ unitPrice: 100, quantity: 1 }]
    expect(calcQuoteTotals(items, true, 0, 0.5, 0, 0).total).toBe(110)
    expect(calcQuoteTotals(items, true, 0, 0.5, 20, 100)).toMatchObject({ subtotal: 0, gstAmount: 0, total: 0, deposit: 0, balance: 0 })
    expect(calcQuoteTotals(items, false, 0, 0.5, 100, 10)).toMatchObject({ total: 90, gstAmount: 0, balance: 0 })
    expect(calcQuoteTotals([], true, 0, 0.5, 0, 50).total).toBe(0)
  })

  it('rejects negative, excessive or non-finite percentages and invalid notes', () => {
    for (const percent of [-1, 100.01, NaN, Infinity]) {
      expect(() => calcQuoteTotals([], true, 0, 0.5, 0, percent)).toThrow()
      expect(isValidQuoteDiscount({ percent, note: '' })).toBe(false)
      const quote = draft()
      expect(quoteReducer(quote, { type: 'SET_DISCOUNT', discount: { percent, note: '' } })).toBe(quote)
    }
    expect(isValidQuoteDiscount({ percent: '10', note: '' })).toBe(false)
    expect(isValidQuoteDiscount({ percent: 10, note: 'x'.repeat(1001) })).toBe(false)
  })

  it('preserves discounts through reload, duplication and revision, but clears them for a new quote', () => {
    const quote = draft()
    expect(normalizeQuote(JSON.parse(JSON.stringify(quote))).discount).toEqual(quote.discount)
    expect(buildDuplicatedQuote(quote, 'COPY').discount).toEqual(quote.discount)
    const snapshot = createIssuedSnapshot(quote, 50, 0.5)
    const issued = quoteReducer(quote, { type: 'ISSUE', snapshot })
    expect(snapshot.discount).toEqual({ ...quote.discount, amount: 105, subtotalBeforeDiscount: 1050 })
    expect(quoteReducer(issued, { type: 'REVISE' }).discount).toEqual(quote.discount)
    expect(quoteReducer(issued, { type: 'NEW_QUOTE', quoteNo: 'NEW' }).discount).toBeUndefined()
    for (const locked of [issued, { ...quote, dealStatus: 'closed' as const }, { ...quote, dealStatus: 'abandoned' as const }]) {
      expect(quoteReducer(locked, { type: 'SET_DISCOUNT', discount: { percent: 50, note: 'Changed' } })).toBe(locked)
    }
    quote.discount!.note = 'Changed later'
    expect(quoteFinancials(issued, { colourExtra: 200, depositRate: 0.8 })).toMatchObject({ total: 1039.5, discountNote: 'Defence discount', discountAmount: 105 })
  })

  it('leaves legacy totals and approval fingerprints unchanged when no discount is set', () => {
    const quote = draft()
    delete quote.discount
    const normalized = normalizeQuote(quote)
    expect(normalized.discount).toBeUndefined()
    expect(JSON.parse(quoteReviewContent(normalized, terms))).not.toHaveProperty('discount')
    const snapshot = createIssuedSnapshot(quote, 50, 0.5)
    expect(snapshot.discount).toBeUndefined()
    expect(quoteFinancials({ ...quote, status: 'issued', issuedSnapshot: snapshot }, terms)).toMatchObject({ total: 1155, subtotalBeforeDiscount: 1050, discountAmount: 0 })
  })

  it('requires a new approval for changes to either the percentage or its customer-visible note', () => {
    const storage = new MemoryStorage()
    const quote = submitQuoteForReview(draft(), 'staff', terms, storage).record.quote
    decideReview(quote.quoteNo, 1, 'approved', 'admin', '', storage)
    expect(canIssueReviewedQuote(quote, false, terms, storage)).toBe(true)
    for (const discount of [{ percent: 15, note: 'Defence discount' }, { percent: 10, note: 'Pensioner discount' }]) {
      expect(canIssueReviewedQuote({ ...quote, discount }, false, terms, storage)).toBe(false)
    }
  })
})
