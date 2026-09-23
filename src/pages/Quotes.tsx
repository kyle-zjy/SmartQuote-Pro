import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import RevisionSnapshot from '../components/RevisionSnapshot'
import { displayQuoteNo, displayQuoteRevision } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'
import { partitionArchivedQuoteGroups, type ArchivedQuoteGroup } from '../lib/quoteArchive'
import { useQuote } from '../lib/quoteContext'
import type { DealStatus, QuoteStatus } from '../lib/quoteLifecycle'
import {
  countSnapshotPhotos,
  formatSnapshotDate,
  formatSnapshotDateTime,
} from '../lib/revisionSnapshot'

const SECTIONS: Array<{ status: DealStatus; slug: string; title: string; hint: string }> = [
  { status: 'open', slug: 'in-progress', title: 'In progress', hint: 'Still quoting or waiting on the customer.' },
  { status: 'abandoned', slug: 'abandoned', title: 'Abandoned', hint: 'Customer declined, or this quote is no longer going ahead.' },
  { status: 'closed', slug: 'closed', title: 'Closed', hint: 'Deal won — the job is proceeding.' },
]

type DealFilter = 'all' | DealStatus
type QuoteStatusFilter = 'all' | QuoteStatus

const QUOTE_STATUS_FILTERS: Array<{ value: QuoteStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'office-review', label: 'Office Review' },
  { value: 'issued', label: 'Issued' },
]

function filterGroupsByQuoteStatus(groups: ArchivedQuoteGroup[], filter: QuoteStatusFilter): ArchivedQuoteGroup[] {
  if (filter === 'all') return groups
  return groups.filter((group) => group.versions[0]?.quote.status === filter)
}

export default function Quotes() {
  const navigate = useNavigate()
  const [dealFilter, setDealFilter] = useState<DealFilter>('all')
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatusFilter>('all')
  const {
    items,
    customer,
    quoteNo,
    version,
    savedQuotes,
    loadSavedQuote,
    deleteSavedQuote,
    addSavedQuoteComment,
    setQuoteDealStatus,
  } = useQuote()
  const hasDraft = items.length > 0 || Boolean(customer.name.trim())
  const boards = partitionArchivedQuoteGroups(savedQuotes)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [snapshot, setSnapshot] = useState<{ quoteNo: string; version: number } | null>(null)
  const closeSnapshot = useCallback(() => setSnapshot(null), [])
  const snapshotRecord = snapshot
    ? savedQuotes.find((record) => record.quoteNo === snapshot.quoteNo && record.version === snapshot.version)
    : undefined
  const snapshotSiblings = snapshotRecord
    ? savedQuotes.filter((record) => record.quoteNo === snapshotRecord.quoteNo)
    : []
  const visibleSections = dealFilter === 'all' ? SECTIONS : SECTIONS.filter((section) => section.status === dealFilter)
  const totalCount = Object.values(boards).reduce((sum, groups) => sum + groups.length, 0)

  function commentKey(savedQuoteNo: string, savedVersion: number) {
    return `${savedQuoteNo}:${savedVersion}`
  }

  function handleOpen(savedQuoteNo: string, savedVersion: number) {
    const sameOpen = savedQuoteNo === quoteNo && savedVersion === version
    if (!sameOpen && hasDraft) {
      const ok = window.confirm(
        'Open this saved quote? The quote you are editing now will be replaced. Save it first if you still need it.',
      )
      if (!ok) return
    }
    if (!loadSavedQuote(savedQuoteNo, savedVersion)) return
    navigate(`/quotes/${savedQuoteNo}`)
  }

  function handleDelete(savedQuoteNo: string, savedVersion: number, label: string) {
    if (!window.confirm(`Delete ${label}? Older/newer revisions of this quote number are kept.`)) return
    deleteSavedQuote(savedQuoteNo, savedVersion)
  }

  function handleAddComment(savedQuoteNo: string, savedVersion: number) {
    const key = commentKey(savedQuoteNo, savedVersion)
    if (!addSavedQuoteComment(savedQuoteNo, savedVersion, drafts[key] ?? '')) return
    setDrafts((current) => ({ ...current, [key]: '' }))
  }

  function handleDealStatus(savedQuoteNo: string, next: DealStatus) {
    const messages: Record<DealStatus, string> = {
      open: 'Move this quote back to In progress?',
      abandoned: 'Mark this quote as Abandoned? You can reopen it later.',
      closed: 'Mark this quote as Closed (deal won)? You can reopen it later.',
    }
    if (!window.confirm(messages[next])) return
    setQuoteDealStatus(savedQuoteNo, next)
  }

  return (
    <div className="quotes-page">
      <header className="page-header">
        <div>
          <h1>Quotes</h1>
          <p className="muted">
            Track whether each quote is still in progress, abandoned, or closed, and whether it is a draft, submitted
            for office review, or issued. Comments under a revision record why the customer asked for a change. Use
            Snapshot to review a revision — including photos — without opening it.
          </p>
        </div>
        <Link to="/quotes/new" className="primary-button">
          New quote
        </Link>
      </header>

      <nav className="saved-subnav" aria-label="Filter by deal status">
        <button
          type="button"
          className={`saved-subnav__item saved-subnav__item--all${dealFilter === 'all' ? ' active' : ''}`}
          onClick={() => setDealFilter('all')}
        >
          All
          <span className="saved-subnav__count">{totalCount}</span>
        </button>
        {SECTIONS.map((section) => (
          <button
            key={section.status}
            type="button"
            className={`saved-subnav__item saved-subnav__item--${section.status}${dealFilter === section.status ? ' active' : ''}`}
            onClick={() => setDealFilter(section.status)}
          >
            <span className={`deal-dot deal-dot--${section.status}`} aria-hidden="true" />
            {section.title}
            <span className="saved-subnav__count">{boards[section.status].length}</span>
          </button>
        ))}
      </nav>

      <nav className="saved-subnav" aria-label="Filter by quote status">
        {QUOTE_STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`saved-subnav__item${quoteStatusFilter === option.value ? ' active' : ''}`}
            onClick={() => setQuoteStatusFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {savedQuotes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">No saved quotes yet</p>
          <p className="muted">No saved quotes yet. Open a quote and choose Save quote or Issue quote.</p>
          <Link to="/quotes/new" className="primary-button">
            New quote
          </Link>
        </div>
      ) : (
        visibleSections.map((section) => {
          const groups = filterGroupsByQuoteStatus(boards[section.status], quoteStatusFilter)
          return (
            <section key={section.status} className={`saved-board saved-board--${section.status}`}>
              <h2 className={`saved-board__title saved-board__title--${section.status}`}>{section.title}</h2>
              <p className="muted small">{section.hint}</p>
              {groups.length === 0 ? (
                <p className="muted small">None.</p>
              ) : (
                <QuoteGroupTable
                  groups={groups}
                  dealStatus={section.status}
                  quoteNo={quoteNo}
                  version={version}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  commentKey={commentKey}
                  onOpen={handleOpen}
                  onSnapshot={(savedQuoteNo, savedVersion) => setSnapshot({ quoteNo: savedQuoteNo, version: savedVersion })}
                  onDelete={handleDelete}
                  onAddComment={handleAddComment}
                  onDealStatus={handleDealStatus}
                />
              )}
            </section>
          )
        })
      )}

      {snapshotRecord ? (
        <RevisionSnapshot
          key={`${snapshotRecord.quoteNo}:${snapshotRecord.version}`}
          record={snapshotRecord}
          siblings={snapshotSiblings}
          onClose={closeSnapshot}
          onChangeRevision={(version) => setSnapshot({ quoteNo: snapshotRecord.quoteNo, version })}
        />
      ) : null}
    </div>
  )
}

function QuoteGroupTable({
  groups,
  dealStatus,
  quoteNo,
  version,
  drafts,
  setDrafts,
  commentKey,
  onOpen,
  onSnapshot,
  onDelete,
  onAddComment,
  onDealStatus,
}: {
  groups: ArchivedQuoteGroup[]
  dealStatus: DealStatus
  quoteNo: string
  version: number
  drafts: Record<string, string>
  setDrafts: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void
  commentKey: (quoteNo: string, version: number) => string
  onOpen: (quoteNo: string, version: number) => void
  onSnapshot: (quoteNo: string, version: number) => void
  onDelete: (quoteNo: string, version: number, label: string) => void
  onAddComment: (quoteNo: string, version: number) => void
  onDealStatus: (quoteNo: string, status: DealStatus) => void
}) {
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})

  return (
    <div className="saved-quote-list">
      {groups.map((group) => {
        const latest = group.versions[0]
        if (!latest) return null
        const heading = displayQuoteNo(latest.quote.quoteNo, latest.quote.quoteSuffix)
        return (
          <article key={group.quoteNo} className={`saved-quote-card deal-row--${dealStatus}`}>
            <header className="saved-quote-card__head">
              <div>
                <h3>
                  {heading} <QuoteStatusBadge status={latest.quote.status} />
                </h3>
                <p className="muted small">
                  {latest.quote.customer.name || 'No customer'}
                  {group.versions.length > 1 ? ` · ${group.versions.length} revisions` : ''}
                  {' · Last updated '}
                  {formatSnapshotDateTime(latest.savedAt)}
                </p>
              </div>
              <div className="saved-quote-card__meta">
                <span className={`deal-badge deal-badge--${dealStatus}`}>{sectionTitle(dealStatus)}</span>
                <strong>{formatCurrency(latest.total)}</strong>
                <div className="saved-quotes__actions">
                  <DealStatusButtons status={dealStatus} onChange={(next) => onDealStatus(group.quoteNo, next)} />
                </div>
              </div>
            </header>
            <div className="saved-quotes-table-wrap">
            <table className="quote-table saved-quotes">
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.versions.flatMap((record, index) => {
                  const label = `${heading} ${displayQuoteRevision(record.version)}`
                  const latestRow = index === 0
                  const key = commentKey(record.quoteNo, record.version)
                  const historical = group.versions.length > 1 && !latestRow
                  const photoCount = countSnapshotPhotos(record.quote.roomPhotos).total
                  return [
                    <tr key={key}>
                      <td className={historical ? 'saved-quotes__history' : undefined}>
                        {displayQuoteRevision(record.version)}
                        {record.quote.status === 'issued' ? (
                          <span className="muted small"> (issued)</span>
                        ) : (
                          <span className="muted small"> (draft)</span>
                        )}
                        {latestRow && group.versions.length > 1 ? <span className="muted small"> · latest</span> : null}
                        {record.quoteNo === quoteNo && record.version === version ? (
                          <span className="muted small"> (current)</span>
                        ) : null}
                        {photoCount > 0 ? (
                          <span className="muted small">
                            {' '}
                            · {photoCount} photo{photoCount === 1 ? '' : 's'}
                          </span>
                        ) : record.photosOmitted ? (
                          <span className="muted small"> · photos</span>
                        ) : null}
                      </td>
                      <td>{formatSnapshotDate(record.quote.quoteDate)}</td>
                      <td>{formatCurrency(record.total)}</td>
                      <td className="saved-quotes__actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => onSnapshot(record.quoteNo, record.version)}
                        >
                          Snapshot
                        </button>
                        <button type="button" className="link-button" onClick={() => onOpen(record.quoteNo, record.version)}>
                          Open
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => onDelete(record.quoteNo, record.version, label)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>,
                    <tr key={`${key}:comments`} className="saved-quotes__comment-row">
                      <td colSpan={4} className={historical ? 'saved-quotes__history' : undefined}>
                        <div className="saved-quotes__comments">
                          {record.comments.length > 0 ? (
                            <ul>
                              {record.comments.map((comment) => (
                                <li key={comment.id}>
                                  <span className="muted small">{formatSnapshotDateTime(comment.createdAt)}</span>
                                  <p>{comment.text}</p>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {openComments[key] || Boolean((drafts[key] ?? '').trim()) ? (
                            <>
                              <label>
                                {historical ? 'Add a change note' : 'Add a comment'}
                                <textarea
                                  rows={2}
                                  value={drafts[key] ?? ''}
                                  onChange={(e) => setDrafts((current) => ({ ...current, [key]: e.target.value }))}
                                  placeholder={
                                    historical
                                      ? 'e.g. Customer asked for a lock post on the lounge door'
                                      : 'e.g. Waiting on site measure'
                                  }
                                />
                              </label>
                              <div className="saved-quotes__comment-actions">
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => {
                                    onAddComment(record.quoteNo, record.version)
                                    setOpenComments((current) => ({ ...current, [key]: false }))
                                  }}
                                  disabled={!(drafts[key] ?? '').trim()}
                                >
                                  Add comment
                                </button>
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => {
                                    setOpenComments((current) => ({ ...current, [key]: false }))
                                    setDrafts((current) => ({ ...current, [key]: '' }))
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => setOpenComments((current) => ({ ...current, [key]: true }))}
                            >
                              {historical ? 'Add a change note' : 'Add a comment'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                  ]
                })}
              </tbody>
            </table>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function sectionTitle(status: DealStatus): string {
  return SECTIONS.find((section) => section.status === status)?.title ?? status
}

function DealStatusButtons({
  status,
  onChange,
}: {
  status: DealStatus
  onChange: (status: DealStatus) => void
}) {
  const actions: Array<{ next: DealStatus; label: string }> =
    status === 'open'
      ? [
          { next: 'abandoned', label: 'Abandon' },
          { next: 'closed', label: 'Close deal' },
        ]
      : status === 'abandoned'
        ? [
            { next: 'open', label: 'Reopen' },
            { next: 'closed', label: 'Close deal' },
          ]
        : [
            { next: 'open', label: 'Reopen' },
            { next: 'abandoned', label: 'Abandon' },
          ]

  return (
    <>
      {actions.map((action) => (
        <button
          key={action.next}
          type="button"
          className={`link-button deal-action deal-action--${action.next}`}
          onClick={() => onChange(action.next)}
        >
          {action.label}
        </button>
      ))}
    </>
  )
}
