import { describe, expect, it } from 'vitest'
import type { QuoteState } from './quoteContext'
import { quoteReducer } from './quoteContext'
import {
  canIssueQuote,
  canReviseQuote,
  canSubmitForReview,
  createIssuedSnapshot,
  isActionLocked,
  quoteFinancials,
} from './quoteLifecycle'

function draftQuote(overrides: Partial<QuoteState> = {}): QuoteState {
  return {
    items: [{ id: '1', description: 'Door', detail: '', quantity: 2, unitPrice: 1203, room: 'Lounge', note: '' }],
    gstEnabled: true,
    roomPhotos: {},
    customer: { name: 'Ada', address: '1 Test St', phone: '0400000000' },
    shipSameAsBill: true,
    shipTo: { name: '', address: '', phone: '' },
    quoteNo: '00033021',
    quoteNumber: '33021',
    quoteDate: '2026-08-23',
    frameColour: 'White',
    customFrameColour: '',
    colourExtraOverride: null,
    paid: 0,
    version: 1,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
    ...overrides,
  }
}

describe('quoteLifecycle', () => {
  it('only drafts with line items can be issued', () => {
    expect(canIssueQuote(draftQuote())).toBe(true)
    expect(canIssueQuote(draftQuote({ items: [] }))).toBe(false)
    expect(canIssueQuote(draftQuote({ status: 'issued' }))).toBe(false)
    expect(canIssueQuote(draftQuote({ dealStatus: 'abandoned' }))).toBe(false)
    expect(canIssueQuote(draftQuote({ dealStatus: 'closed' }))).toBe(false)
  })

  it('requires a quote number before it can be submitted for review or issued', () => {
    expect(canSubmitForReview(draftQuote({ quoteNumber: '' }))).toBe(false)
    expect(canSubmitForReview(draftQuote({ quoteNumber: '  ' }))).toBe(false)
    expect(canSubmitForReview(draftQuote())).toBe(true)
    expect(canIssueQuote(draftQuote({ quoteNumber: '' }))).toBe(false)
    expect(canIssueQuote(draftQuote())).toBe(true)
  })

  it('freezes colour extra, GST and deposit at the current totals', () => {
    const snapshot = createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z')
    expect(snapshot).toMatchObject({
      colourExtra: 220,
      gstEnabled: true,
      depositRate: 0.5,
      subtotal: 2626,
      gstAmount: 262.6,
      total: 2888.6,
      deposit: 1444.3,
      issuedAt: '2026-08-24T00:00:00.000Z',
    })
  })

  it('keeps issued totals when the live colour extra or deposit rate changes', () => {
    const issued = draftQuote({
      status: 'issued',
      issuedSnapshot: createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z'),
    })

    expect(quoteFinancials(issued, { colourExtra: 250, depositRate: 0.4 })).toMatchObject({
      colourExtra: 220,
      total: 2888.6,
      deposit: 1444.3,
    })
  })

  it('still updates balance when payment is recorded on an issued quote', () => {
    const issued = draftQuote({
      status: 'issued',
      paid: 100,
      issuedSnapshot: createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z'),
    })

    expect(quoteFinancials(issued, { colourExtra: 250, depositRate: 0.5 })).toMatchObject({
      total: 2888.6,
      paid: 100,
      balance: 2788.6,
    })
  })

  it('locks pricing actions after issue', () => {
    expect(isActionLocked('issued', 'ADD_ITEM')).toBe(true)
    expect(isActionLocked('issued', 'SET_GST')).toBe(true)
    expect(isActionLocked('issued', 'SET_COLOUR')).toBe(true)
    expect(isActionLocked('issued', 'SET_PAID')).toBe(false)
    expect(isActionLocked('draft', 'ADD_ITEM')).toBe(false)
  })

  it('locks line edits when the deal is abandoned or closed', () => {
    expect(isActionLocked('draft', 'ADD_ITEM', 'abandoned')).toBe(true)
    expect(isActionLocked('issued', 'ADD_ITEM', 'closed')).toBe(true)
    expect(isActionLocked('issued', 'REVISE', 'abandoned')).toBe(true)
    expect(isActionLocked('issued', 'SET_PAID', 'closed')).toBe(false)
    expect(isActionLocked('issued', 'SET_DEAL_STATUS', 'closed')).toBe(false)
  })

  it('cannot revise a settled deal', () => {
    expect(canReviseQuote(draftQuote({ status: 'issued' }))).toBe(true)
    expect(canReviseQuote(draftQuote({ status: 'issued', dealStatus: 'closed' }))).toBe(false)
    expect(canReviseQuote(draftQuote({ status: 'issued', dealStatus: 'abandoned' }))).toBe(false)
  })
})

describe('quoteReducer issue lock', () => {
  it('rejects new line items after the quote is issued', () => {
    const snapshot = createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z')
    const issued = quoteReducer(draftQuote(), { type: 'ISSUE', snapshot })
    const next = quoteReducer(issued, {
      type: 'ADD_ITEM',
      item: {
        description: 'Window',
        detail: '',
        quantity: 1,
        unitPrice: 343,
        room: 'Lounge',
        note: '',
      },
    })

    expect(issued.status).toBe('issued')
    expect(next.items).toEqual(issued.items)
  })

  it('still records payment on an issued quote', () => {
    const snapshot = createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z')
    const issued = quoteReducer(draftQuote(), { type: 'ISSUE', snapshot })
    const next = quoteReducer(issued, { type: 'SET_PAID', paid: 200 })
    expect(next.paid).toBe(200)
    expect(next.status).toBe('issued')
  })

  it('opens a new unlocked revision from an issued quote', () => {
    const snapshot = createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z')
    const issued = quoteReducer(draftQuote(), { type: 'ISSUE', snapshot })
    const revised = quoteReducer(issued, { type: 'REVISE' })
    expect(canReviseQuote(issued)).toBe(true)
    expect(canReviseQuote(draftQuote())).toBe(false)
    expect(revised.status).toBe('draft')
    expect(revised.version).toBe(2)
    expect(revised.issuedSnapshot).toBeNull()
    expect(revised.items).toEqual(issued.items)
    expect(isActionLocked(revised.status, 'ADD_ITEM')).toBe(false)
  })

  it('rejects new line items after the deal is closed', () => {
    const closed = quoteReducer(draftQuote(), { type: 'SET_DEAL_STATUS', dealStatus: 'closed' })
    const next = quoteReducer(closed, {
      type: 'ADD_ITEM',
      item: {
        description: 'Window',
        detail: '',
        quantity: 1,
        unitPrice: 343,
        room: 'Lounge',
        note: '',
      },
    })
    expect(next.items).toEqual(closed.items)
  })

  it('still records payment on a closed quote', () => {
    const closed = quoteReducer(draftQuote({ paid: 0 }), { type: 'SET_DEAL_STATUS', dealStatus: 'closed' })
    const next = quoteReducer(closed, { type: 'SET_PAID', paid: 200 })
    expect(next.paid).toBe(200)
    expect(next.dealStatus).toBe('closed')
  })

  it('does not revise an issued quote after the deal is abandoned', () => {
    const snapshot = createIssuedSnapshot(draftQuote(), 220, 0.5, '2026-08-24T00:00:00.000Z')
    const issued = quoteReducer(draftQuote(), { type: 'ISSUE', snapshot })
    const abandoned = quoteReducer(issued, { type: 'SET_DEAL_STATUS', dealStatus: 'abandoned' })
    const revised = quoteReducer(abandoned, { type: 'REVISE' })
    expect(canReviseQuote(abandoned)).toBe(false)
    expect(revised.version).toBe(abandoned.version)
    expect(revised.status).toBe('issued')
  })
})
