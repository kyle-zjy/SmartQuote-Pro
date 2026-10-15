export type ReviewStatus = 'pending' | 'approved' | 'returned'

export interface ReviewRecord {
  quoteNo: string
  version: number
  submittedBy: string
  submittedAt: string
  status: ReviewStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export const REVIEW_KEY = 'smartquote-pro:reviews'
export const OWNER_KEY = 'smartquote-pro:quote-owners'

export function listReviews(storage: Storage = localStorage): ReviewRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(REVIEW_KEY) ?? '[]') as ReviewRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeReviews(reviews: ReviewRecord[], storage: Storage) {
  storage.setItem(REVIEW_KEY, JSON.stringify(reviews))
}

export function getReview(quoteNo: string, version: number, storage: Storage = localStorage): ReviewRecord | undefined {
  return listReviews(storage).find((r) => r.quoteNo === quoteNo && r.version === version)
}

/** Records (or re-opens) a submission; any earlier decision on the same revision is cleared. */
export function recordSubmission(
  quoteNo: string,
  version: number,
  staffId: string,
  storage: Storage = localStorage,
): ReviewRecord {
  const record: ReviewRecord = {
    quoteNo,
    version,
    submittedBy: staffId,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  const rest = listReviews(storage).filter((r) => !(r.quoteNo === quoteNo && r.version === version))
  writeReviews([record, ...rest], storage)
  return record
}

export function decideReview(
  quoteNo: string,
  version: number,
  decision: Exclude<ReviewStatus, 'pending'>,
  reviewerId: string,
  note: string,
  storage: Storage = localStorage,
): ReviewRecord | null {
  let updated: ReviewRecord | null = null
  const next = listReviews(storage).map((r) => {
    if (r.quoteNo !== quoteNo || r.version !== version) return r
    updated = {
      ...r,
      status: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewNote: note.trim() || undefined,
    }
    return updated
  })
  if (updated) writeReviews(next, storage)
  return updated
}

export function readOwners(storage: Storage = localStorage): Record<string, string> {
  try {
    const parsed = JSON.parse(storage.getItem(OWNER_KEY) ?? '{}') as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function recordQuoteOwner(quoteNo: string, staffId: string, storage: Storage = localStorage) {
  const owners = readOwners(storage)
  if (owners[quoteNo]) return
  storage.setItem(OWNER_KEY, JSON.stringify({ ...owners, [quoteNo]: staffId }))
}
