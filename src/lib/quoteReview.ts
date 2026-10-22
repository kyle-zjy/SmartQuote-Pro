import { workspaceStorage } from './workspaceStorage'
import type { QuoteState } from './quoteContext'
import { ARCHIVE_KEY, upsertArchivedQuote } from './quoteArchive'
import { canIssueQuote, canSubmitForReview, quoteFinancials } from './quoteLifecycle'
import { getReview, OWNER_KEY, recordQuoteOwner, recordSubmission, REVIEW_KEY, type ReviewRecord } from './reviewStore'
import { withStorageRollback } from './storageTransaction'

export interface ReviewTerms {
  colourExtra: number
  depositRate: number
}

/** Keep approvals tied to the customer, measurements, prices and commercial terms reviewed. */
export function quoteReviewContent(quote: QuoteState, terms: ReviewTerms): string {
  return JSON.stringify({
    quoteNo: quote.quoteNo,
    version: quote.version,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    ...(quote.discount !== undefined ? { discount: quote.discount } : {}),
    customer: quote.customer,
    shipSameAsBill: quote.shipSameAsBill,
    shipTo: quote.shipSameAsBill ? null : quote.shipTo,
    frameColour: quote.frameColour,
    customFrameColour: quote.customFrameColour,
    gstEnabled: quote.gstEnabled,
    items: quote.items.map((item) => ({ ...item, photos: undefined })),
    ...terms,
  }, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
}

export function reviewMatchesQuote(review: ReviewRecord | undefined, quote: QuoteState, terms: ReviewTerms): boolean {
  return Boolean(review?.contentKey && review.contentKey === quoteReviewContent(quote, terms))
}

export function canIssueReviewedQuote(
  quote: QuoteState,
  isAdmin: boolean,
  terms: ReviewTerms,
  storage: Storage = workspaceStorage,
): boolean {
  if (!canIssueQuote(quote) || !quote.customer.name.trim() || !quote.customer.address.trim()) return false
  if (isAdmin) return true
  const review = getReview(quote.quoteNo, quote.version, storage)
  return quote.status === 'office-review' && review?.status === 'approved' && reviewMatchesQuote(review, quote, terms)
}

/** Archive the submitted state and its review together; never claim submission after a failed write. */
export function submitQuoteForReview(
  quote: QuoteState,
  staffId: string,
  terms: ReviewTerms,
  storage: Storage = workspaceStorage,
) {
  if (!canSubmitForReview({ ...quote, status: quote.status === 'office-review' ? 'draft' : quote.status }) ||
      !quote.customer.name.trim() || !quote.customer.address.trim() || !staffId) {
    throw new Error('Add a customer, site address, quote number and at least one item before submitting.')
  }
  const submitted: QuoteState = { ...quote, status: 'office-review' }
  return withStorageRollback(storage, [ARCHIVE_KEY, REVIEW_KEY, OWNER_KEY], () => {
    const result = upsertArchivedQuote(submitted, { total: quoteFinancials(submitted, terms).total }, storage)
    recordQuoteOwner(quote.quoteNo, staffId, storage)
    recordSubmission(quote.quoteNo, quote.version, staffId, storage, quoteReviewContent(submitted, terms))
    return result
  })
}
