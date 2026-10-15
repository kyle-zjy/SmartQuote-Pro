import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'
import { useAuth } from '../lib/authContext'
import { decideReview, listReviews, type ReviewRecord, type ReviewStatus } from '../lib/reviewStore'
import { listStaff } from '../lib/staffStore'
import { getArchivedQuote } from '../lib/quoteArchive'
import { displayQuoteNo, displayQuoteRevision } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'

const FILTERS: Array<{ value: ReviewStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'returned', label: 'Returned to staff' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
]

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  returned: 'Returned',
}

function formatWhen(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminReviews() {
  const { user } = useAuth()
  const { savedQuotes, loadSavedQuote, addSavedQuoteComment } = useQuote()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending')
  const [reviews, setReviews] = useState<ReviewRecord[]>(() => listReviews())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  const staffById = useMemo(() => new Map(listStaff().map((m) => [m.id, m])), [])
  // savedQuotes changes whenever the archive is written, so re-read records on each render of it.
  const rows = useMemo(
    () =>
      reviews
        .map((review) => ({ review, record: getArchivedQuote(review.quoteNo, review.version) }))
        .filter(({ record }) => Boolean(record)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviews, savedQuotes],
  )
  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { pending: 0, approved: 0, returned: 0 }
    rows.forEach(({ review }) => (c[review.status] += 1))
    return c
  }, [rows])
  const visible = filter === 'all' ? rows : rows.filter(({ review }) => review.status === filter)

  function key(review: ReviewRecord) {
    return `${review.quoteNo}:${review.version}`
  }

  function decide(review: ReviewRecord, decision: 'approved' | 'returned') {
    if (!user) return
    const note = notes[key(review)] ?? ''
    if (decision === 'returned' && !note.trim()) {
      setMessage('Add a note explaining what the staff member needs to change before returning the quote.')
      return
    }
    decideReview(review.quoteNo, review.version, decision, user.id, note)
    const prefix = decision === 'approved' ? 'Office review approved' : 'Office review returned'
    addSavedQuoteComment(review.quoteNo, review.version, `${prefix} by ${user.name}${note.trim() ? `: ${note.trim()}` : '.'}`)
    setReviews(listReviews())
    setNotes((current) => ({ ...current, [key(review)]: '' }))
    setMessage(
      decision === 'approved'
        ? `Quote ${review.quoteNo} approved. The staff member can now issue it.`
        : `Quote ${review.quoteNo} returned to the staff member with your note.`,
    )
  }

  function openQuote(review: ReviewRecord) {
    if (!loadSavedQuote(review.quoteNo, review.version)) return
    navigate(`/quotes/${encodeURIComponent(review.quoteNo)}`)
  }

  return (
    <section className="admin-panel">
      <h2>Office review</h2>
      <p className="muted small">
        Quotes staff submit with “Submit for Office Review” arrive here. Approve them so staff can issue, or return them
        with a note.
      </p>

      <nav className="saved-subnav" aria-label="Filter reviews">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`saved-subnav__item${filter === f.value ? ' active' : ''}`}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            <span className="saved-subnav__count">{f.value === 'all' ? rows.length : counts[f.value]}</span>
          </button>
        ))}
      </nav>

      {message ? (
        <p className="admin-panel__message" role="status">
          {message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="empty-state empty-state--inline">
          <p className="empty-state__title">Nothing here</p>
          <p className="muted">
            {filter === 'pending' ? 'No quotes are waiting for office review.' : 'No quotes match this filter.'}
          </p>
        </div>
      ) : (
        <div className="review-list">
          {visible.map(({ review, record }) => {
            const quote = record!.quote
            const submitter = staffById.get(review.submittedBy)
            const reviewer = review.reviewedBy ? staffById.get(review.reviewedBy) : undefined
            const k = key(review)
            return (
              <article key={k} className={`review-card review-card--${review.status}`} aria-label={`Review ${review.quoteNo}`}>
                <header className="review-card__head">
                  <div>
                    <h3>
                      Quote {displayQuoteNo(quote.quoteNo, quote.quoteNumber)} · {displayQuoteRevision(review.version)}
                    </h3>
                    <p className="muted small">
                      {quote.customer.name || 'No customer'} · {record!.itemCount} item{record!.itemCount === 1 ? '' : 's'} ·{' '}
                      {formatCurrency(record!.total)}
                    </p>
                  </div>
                  <span className={`review-pill review-pill--${review.status}`}>{STATUS_LABEL[review.status]}</span>
                </header>
                <dl className="review-card__meta">
                  <div>
                    <dt>Submitted by</dt>
                    <dd>{submitter?.name ?? 'Unknown staff'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatWhen(review.submittedAt)}</dd>
                  </div>
                  <div>
                    <dt>Site</dt>
                    <dd>{quote.customer.address.split('\n')[0] || '—'}</dd>
                  </div>
                  {review.status !== 'pending' ? (
                    <div>
                      <dt>Reviewed</dt>
                      <dd>
                        {reviewer?.name ?? 'Admin'} · {formatWhen(review.reviewedAt)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {quote.items.length > 0 ? (
                  <ul className="review-card__items">
                    {quote.items.slice(0, 6).map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.quantity} × {item.location || item.room || 'Item'} — {item.description}
                        </span>
                        <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                      </li>
                    ))}
                    {quote.items.length > 6 ? <li className="muted">+ {quote.items.length - 6} more</li> : null}
                  </ul>
                ) : null}
                {review.reviewNote ? <p className="review-card__note">Note: {review.reviewNote}</p> : null}
                <div className="review-card__actions">
                  <button type="button" className="secondary-button" onClick={() => openQuote(review)}>
                    Open quote
                  </button>
                  {review.status === 'pending' ? (
                    <>
                      <label className="review-card__note-input">
                        <span className="visually-hidden">Review note for quote {review.quoteNo}</span>
                        <input
                          placeholder="Note to staff (required to return)"
                          value={notes[k] ?? ''}
                          onChange={(e) => setNotes((current) => ({ ...current, [k]: e.target.value }))}
                        />
                      </label>
                      <button type="button" className="secondary-button" onClick={() => decide(review, 'returned')}>
                        Return to staff
                      </button>
                      <button type="button" className="primary-button" onClick={() => decide(review, 'approved')}>
                        Approve
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
