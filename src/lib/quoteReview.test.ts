import { describe, expect, it } from 'vitest'
import { normalizeQuote } from './quoteContext'
import { ARCHIVE_KEY, getArchivedQuote, upsertArchivedQuote } from './quoteArchive'
import { canIssueReviewedQuote, quoteReviewContent, reviewMatchesQuote, submitQuoteForReview } from './quoteReview'
import { decideReview, getReview, OWNER_KEY, REVIEW_KEY } from './reviewStore'

class MemoryStorage implements Storage {
  data = new Map<string, string>()
  failKey?: string
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Storage unavailable')
    this.data.set(key, value)
  }
}

const terms = { colourExtra: 220, depositRate: 0.5 }
function draft() {
  return normalizeQuote({
    quoteNo: '33021', quoteNumber: '33021',
    customer: { name: 'Ada', address: '1 Test St', phone: '0400000000' },
    items: [{ id: '1', description: 'Door', detail: '', quantity: 1, unitPrice: 650, room: 'Living', note: '' }],
  })
}

describe('reviewed quote lifecycle', () => {
  it('archives the submitted status and total together with a pending review and owner', () => {
    const storage = new MemoryStorage()
    const result = submitQuoteForReview(draft(), 'staff', terms, storage)
    expect(result.record.quote.status).toBe('office-review')
    expect(result.record.total).toBe(957)
    expect(getReview('33021', 1, storage)?.status).toBe('pending')
    expect(JSON.parse(storage.getItem(OWNER_KEY)!)).toEqual({ '33021': 'staff' })
    expect(reviewMatchesQuote(getReview('33021', 1, storage), result.record.quote, terms)).toBe(true)
  })

  it('blocks staff before approval and after commercial content changes; admins can issue directly', () => {
    const storage = new MemoryStorage()
    const quote = draft()
    expect(canIssueReviewedQuote(quote, false, terms, storage)).toBe(false)
    expect(canIssueReviewedQuote(quote, true, terms, storage)).toBe(true)
    const submitted = submitQuoteForReview(quote, 'staff', terms, storage).record.quote
    expect(canIssueReviewedQuote(submitted, false, terms, storage)).toBe(false)
    decideReview('33021', 1, 'approved', 'admin', '', storage)
    expect(canIssueReviewedQuote(submitted, false, terms, storage)).toBe(true)
    expect(canIssueReviewedQuote({ ...submitted, items: [{ ...submitted.items[0], quantity: 2 }] }, false, terms, storage)).toBe(false)
    expect(canIssueReviewedQuote({ ...submitted, customer: { ...submitted.customer, address: '2 Changed St' } }, false, terms, storage)).toBe(false)
    expect(canIssueReviewedQuote(submitted, false, { ...terms, colourExtra: 250 }, storage)).toBe(false)
    expect(canIssueReviewedQuote(submitted, false, { ...terms, depositRate: 0.4 }, storage)).toBe(false)
    expect(canIssueReviewedQuote({ ...submitted, dealStatus: 'closed' }, true, terms, storage)).toBe(false)
  })

  it('resubmits the edited revision and clears the earlier decision', () => {
    const storage = new MemoryStorage()
    const submitted = submitQuoteForReview(draft(), 'staff', terms, storage).record.quote
    decideReview('33021', 1, 'returned', 'admin', 'Check width', storage)
    const edited = { ...submitted, items: [{ ...submitted.items[0], detail: '900 x 2100 mm' }] }
    submitQuoteForReview(edited, 'staff', terms, storage)
    expect(getReview('33021', 1, storage)).toMatchObject({ status: 'pending', contentKey: quoteReviewContent(edited, terms) })
    expect(getReview('33021', 1, storage)?.reviewNote).toBeUndefined()
    expect(getArchivedQuote('33021', 1, storage)?.quote.items[0].detail).toBe('900 x 2100 mm')
  })

  it('restores the prior archive when the review write fails', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(draft(), { total: 650 }, storage)
    const previous = storage.getItem(ARCHIVE_KEY)
    storage.failKey = REVIEW_KEY
    expect(() => submitQuoteForReview(draft(), 'staff', terms, storage)).toThrow()
    expect(storage.getItem(ARCHIVE_KEY)).toBe(previous)
    expect(storage.getItem(OWNER_KEY)).toBeNull()
    expect(storage.getItem(REVIEW_KEY)).toBeNull()
  })

  it('does not create a review when the archive cannot be saved', () => {
    const storage = new MemoryStorage()
    storage.failKey = ARCHIVE_KEY
    expect(() => submitQuoteForReview(draft(), 'staff', terms, storage)).toThrow()
    expect(storage.length).toBe(0)
  })

  it('does not invalidate approval for payments, image hydration or object property order', () => {
    const quote = draft()
    const key = quoteReviewContent(quote, terms)
    const changed = { ...quote, paid: 100, roomPhotos: { Living: [{ id: 'photo', dataUrl: 'data:image/png;base64,test', caption: '' }] } }
    changed.customer = { phone: quote.customer.phone, address: quote.customer.address, name: quote.customer.name, email: quote.customer.email }
    expect(quoteReviewContent(changed, terms)).toBe(key)
  })

  it('requires old approvals without a content snapshot to be resubmitted', () => {
    const storage = new MemoryStorage()
    const submitted = submitQuoteForReview(draft(), 'staff', terms, storage).record.quote
    decideReview('33021', 1, 'approved', 'admin', '', storage)
    const review = getReview('33021', 1, storage)!
    delete review.contentKey
    storage.setItem(REVIEW_KEY, JSON.stringify([review]))
    expect(canIssueReviewedQuote(submitted, false, terms, storage)).toBe(false)
  })
})
