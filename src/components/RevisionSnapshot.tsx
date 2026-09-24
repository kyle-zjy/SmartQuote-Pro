import { useEffect, useMemo, useState } from 'react'
import { useCompanySettings } from '../lib/companySettings'
import { displayFrameColour } from '../lib/frameColour'
import { displayQuoteNo, displayQuoteRevision } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'
import { partyLines } from '../lib/partyLines'
import { colourSurcharge } from '../lib/quoteContext'
import type { ArchivedQuote } from '../lib/quoteArchive'
import type { DealStatus } from '../lib/quoteLifecycle'
import { quoteFinancials } from '../lib/quoteLifecycle'
import { loadRoomPhotos } from '../lib/quotePhotoStore'
import { GST_RATE, lineAmount } from '../lib/quoteTotals'
import {
  adjacentRevisions,
  countSnapshotPhotos,
  formatSnapshotDate,
  formatSnapshotDateTime,
  mergeRoomPhotos,
  photosForRoom,
  snapshotProductName,
  snapshotRooms,
} from '../lib/revisionSnapshot'
import type { RoomPhoto } from '../lib/quoteContext'

const DEAL_LABEL: Record<DealStatus, string> = {
  open: 'In progress',
  abandoned: 'Abandoned',
  closed: 'Closed',
}

export default function RevisionSnapshot({
  record,
  siblings,
  onClose,
  onChangeRevision,
  onReturnToCurrent,
}: {
  record: ArchivedQuote
  siblings: ArchivedQuote[]
  onClose: () => void
  onChangeRevision: (version: number) => void
  onReturnToCurrent?: () => void
}) {
  const { settings } = useCompanySettings()
  const quote = record.quote
  const [photos, setPhotos] = useState(() => mergeRoomPhotos(quote.roomPhotos, null))
  const [photosLoading, setPhotosLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState<{ room: string; photo: RoomPhoto } | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (activePhoto) {
          setActivePhoto(null)
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, activePhoto])

  useEffect(() => {
    let cancelled = false
    const archivedPhotos = record.quote.roomPhotos
    setPhotos(mergeRoomPhotos(archivedPhotos, null))
    setPhotosLoading(true)
    setActivePhoto(null)
    void loadRoomPhotos(record.quoteNo, record.version)
      .then((stored) => {
        if (cancelled) return
        setPhotos(mergeRoomPhotos(archivedPhotos, stored))
      })
      .catch(() => {
        // Keep whatever the archive already has.
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [record.quoteNo, record.quote.roomPhotos, record.version])

  const defaultExtra = colourSurcharge(quote.frameColour, settings.nonStandardColourPrice)
  const liveColourExtra = defaultExtra > 0 ? (quote.colourExtraOverride ?? defaultExtra) : 0
  const financials = quoteFinancials(quote, {
    colourExtra: liveColourExtra,
    depositRate: settings.depositRate,
  })
  const heading = displayQuoteNo(quote.quoteNo, quote.quoteSuffix)
  const billLines = partyLines(quote.customer.name, quote.customer.address, quote.customer.phone)
  const shipParty = quote.shipSameAsBill ? quote.customer : quote.shipTo
  const shipLines = partyLines(shipParty.name, shipParty.address, shipParty.phone)
  const rooms = snapshotRooms(quote.items, photos)
  const photoCounts = countSnapshotPhotos(photos)
  const { older, newer } = adjacentRevisions(siblings, record.version)
  const colourName = displayFrameColour(quote.frameColour, quote.customFrameColour)
  const photoHint = useMemo(() => {
    if (photosLoading) return 'Loading photos…'
    if (photoCounts.withImage > 0) return `${photoCounts.withImage} photo${photoCounts.withImage === 1 ? '' : 's'}`
    if (photoCounts.total > 0 || record.photosOmitted) {
      return 'Photos were saved with this revision, but the image files are not on this browser.'
    }
    return 'No photos on this revision.'
  }, [photosLoading, photoCounts, record.photosOmitted])

  return (
    <>
    <div className="quote-preview-overlay" onClick={onClose}>
      <div
        className="quote-preview quote-preview--snapshot"
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-snapshot-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="quote-preview__header">
          <div>
            <h2 id="revision-snapshot-title">
              Snapshot · {heading} · {displayQuoteRevision(record.version)}
            </h2>
            <p className="muted small">Read-only copy of this revision. The quote you are editing stays as it is.</p>
          </div>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="quote-preview__body snapshot-body">
          <ul className="snapshot-chips">
            <li>
              <span className={`deal-badge deal-badge--${quote.dealStatus ?? 'open'}`}>
                {DEAL_LABEL[quote.dealStatus ?? 'open']}
              </span>
            </li>
            <li>
              <span className="snapshot-chip">{quote.status === 'issued' ? 'Issued' : 'Draft'}</span>
            </li>
            <li>
              <span className="snapshot-chip">{quote.gstEnabled ? `GST ${Math.round(GST_RATE * 100)}%` : 'GST off'}</span>
            </li>
            <li>
              <span className="snapshot-chip">
                {quote.items.length} line{quote.items.length === 1 ? '' : 's'} · {record.itemCount} qty
              </span>
            </li>
            <li>
              <span className="snapshot-chip">{photoHint}</span>
            </li>
          </ul>

          <section className="snapshot-section">
            <h3>Quote details</h3>
            <dl className="snapshot-dl">
              <div>
                <dt>Quote no.</dt>
                <dd>{heading}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{displayQuoteRevision(record.version)}</dd>
              </div>
              <div>
                <dt>Quote date</dt>
                <dd>{formatSnapshotDate(quote.quoteDate)}</dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd>{formatSnapshotDateTime(record.savedAt)}</dd>
              </div>
              {quote.issuedSnapshot ? (
                <div>
                  <dt>Issued</dt>
                  <dd>{formatSnapshotDateTime(quote.issuedSnapshot.issuedAt)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Frame colour</dt>
                <dd>{colourName || '—'}</dd>
              </div>
              <div>
                <dt>Colour extra</dt>
                <dd>
                  {financials.colourExtra > 0 ? formatCurrency(financials.colourExtra) : 'None'}
                  {quote.colourExtraOverride !== null ? ` · override ${formatCurrency(quote.colourExtraOverride)}` : ''}
                </dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{formatCurrency(quote.paid)}</dd>
              </div>
              <div>
                <dt>Deposit required</dt>
                <dd>
                  {formatCurrency(financials.deposit)}
                  {quote.issuedSnapshot
                    ? ` (${Math.round(quote.issuedSnapshot.depositRate * 100)}% locked)`
                    : ` (${Math.round(settings.depositRate * 100)}%)`}
                </dd>
              </div>
            </dl>
            {quote.status === 'issued' && quote.issuedSnapshot ? (
              <p className="muted small">Pricing on this revision was locked when it was issued.</p>
            ) : null}
          </section>

          <section className="snapshot-section">
            <h3>Customer</h3>
            <div className="snapshot-parties">
              <div>
                <h4>Bill to</h4>
                {billLines.map((line, index) => (
                  <p key={`bill-${index}`}>{line}</p>
                ))}
              </div>
              <div>
                <h4>Ship to</h4>
                {quote.shipSameAsBill ? <p className="muted small">Same as bill to</p> : null}
                {shipLines.map((line, index) => (
                  <p key={`ship-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          </section>

          <section className="snapshot-section">
            <h3>Line items</h3>
            {quote.items.length === 0 ? (
              <p className="muted">No line items on this revision.</p>
            ) : (
              <div className="snapshot-table-wrap">
                <table className="quote-table snapshot-lines">
                  <thead>
                    <tr>
                      <th>Qty</th>
                      <th>Description</th>
                      <th>Size</th>
                      <th>Room</th>
                      <th>Product</th>
                      <th>Unit</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.quantity}</td>
                        <td>
                          <div>{item.description || '—'}</div>
                          {item.note ? <div className="muted small">Note: {item.note}</div> : null}
                        </td>
                        <td>{item.detail || '—'}</td>
                        <td>{item.room.trim() || 'Unassigned'}</td>
                        <td>{snapshotProductName(item.productKey)}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{formatCurrency(lineAmount(item.unitPrice, item.quantity))}</td>
                      </tr>
                    ))}
                    {financials.colourExtra > 0 ? (
                      <tr>
                        <td>1</td>
                        <td>Powder coating for non-standard colour</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{formatCurrency(financials.colourExtra)}</td>
                        <td>{formatCurrency(financials.colourExtra)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="snapshot-section">
            <h3>Totals</h3>
            <dl className="snapshot-totals">
              <div>
                <dt>Sale amount</dt>
                <dd>{formatCurrency(financials.subtotal)}</dd>
              </div>
              <div>
                <dt>GST</dt>
                <dd>{formatCurrency(financials.gstAmount)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatCurrency(financials.total)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{formatCurrency(financials.paid)}</dd>
              </div>
              <div>
                <dt>Balance due</dt>
                <dd>{formatCurrency(financials.balance)}</dd>
              </div>
            </dl>
          </section>

          <section className="snapshot-section">
            <h3>Photos</h3>
            <p className="muted small">{photoHint}</p>
            {rooms.map((room) => {
              const roomPhotos = photosForRoom(photos, room)
              if (roomPhotos.length === 0) return null
              return (
                <div key={room} className="snapshot-room">
                  <h4>{room}</h4>
                  <div className="snapshot-photos">
                    {roomPhotos.map((photo) => (
                      <figure key={photo.id} className="snapshot-photo">
                        {photo.dataUrl ? (
                          <button
                            type="button"
                            className="snapshot-photo__thumb"
                            onClick={() => setActivePhoto({ room, photo })}
                          >
                            <img src={photo.dataUrl} alt={photo.caption || `${room} photo`} />
                          </button>
                        ) : (
                          <div className="snapshot-photo__missing">Image not on this browser</div>
                        )}
                        <figcaption>
                          {photo.caption.trim() ? photo.caption : <span className="muted">No caption</span>}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>

          <section className="snapshot-section">
            <h3>Comments</h3>
            {record.comments.length === 0 ? (
              <p className="muted">No comments on this revision.</p>
            ) : (
              <ul className="snapshot-comments">
                {record.comments.map((comment) => (
                  <li key={comment.id}>
                    <span className="muted small">{formatSnapshotDateTime(comment.createdAt)}</span>
                    <p>{comment.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="quote-preview__footer snapshot-footer">
          <div className="snapshot-nav">
            <button
              type="button"
              className="link-button"
              disabled={!older}
              onClick={() => older && onChangeRevision(older.version)}
            >
              {older ? `Older · ${displayQuoteRevision(older.version)}` : 'No older revision'}
            </button>
            <button
              type="button"
              className="link-button"
              disabled={!newer}
              onClick={() => newer && onChangeRevision(newer.version)}
            >
              {newer ? `Newer · ${displayQuoteRevision(newer.version)}` : 'No newer revision'}
            </button>
          </div>
          {onReturnToCurrent && (
            <button type="button" className="primary-button" onClick={onReturnToCurrent}>
              Continue current quote
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
    {activePhoto ? (
      <div className="photo-modal-overlay snapshot-lightbox" onClick={() => setActivePhoto(null)}>
        <div className="photo-modal" onClick={(event) => event.stopPropagation()}>
          <img src={activePhoto.photo.dataUrl} alt={activePhoto.photo.caption || `${activePhoto.room} photo`} />
          <p>
            <strong>{activePhoto.room}</strong>
            {activePhoto.photo.caption.trim() ? ` — ${activePhoto.photo.caption}` : ''}
          </p>
          <div className="photo-modal__actions">
            <span />
            <button type="button" className="link-button" onClick={() => setActivePhoto(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
