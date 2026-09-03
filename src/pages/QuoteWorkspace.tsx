import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import colours from '../data/colours.json'
import QuoteItemCard from '../components/QuoteItemCard'
import QuotePdfPreview from '../components/QuotePdfPreview'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import { useCompanySettings } from '../lib/companySettings'
import { formatCurrency } from '../lib/formatCurrency'
import { isOtherFrameColour } from '../lib/frameColour'
import { suggestQuoteSuffix } from '../lib/lineDescription'
import { canIssueQuote, canReviseQuote, canSubmitForReview } from '../lib/quoteLifecycle'
import { colourRecord, useQuote } from '../lib/quoteContext'

function formatIssuedAt(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export default function QuoteWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { settings } = useCompanySettings()
  const quote = useQuote()
  const {
    items,
    customer,
    setCustomer,
    shipSameAsBill,
    setShipSameAsBill,
    shipTo,
    setShipTo,
    quoteDate,
    setQuoteDate,
    quoteSuffix,
    setQuoteSuffix,
    frameColour,
    setFrameColour,
    customFrameColour,
    setCustomFrameColour,
    colourExtra,
    setColourExtraOverride,
    paid,
    setPaid,
    gstEnabled,
    setGstEnabled,
    quoteNo,
    version,
    status,
    dealStatus,
    issuedSnapshot,
    subtotal,
    gstAmount,
    total,
    savedQuotes,
    saveCurrentQuote,
    submitForReview,
    issueQuote,
    reviseQuote,
    removeItem,
    setQuantity,
    loadSavedQuote,
    clear,
  } = quote

  const [previewOpen, setPreviewOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (id && id !== quoteNo) {
      const ok = loadSavedQuote(id)
      setNotFound(!ok)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (id && id !== quoteNo) {
    if (notFound) {
      return (
        <div>
          <p className="price-result--error">Quote {id} could not be found.</p>
          <Link to="/quotes">&larr; Back to Quotes</Link>
        </div>
      )
    }
    return <p className="muted">Loading quote…</p>
  }

  const issued = status === 'issued'
  const dealSettled = dealStatus !== 'open'
  const locked = issued || dealSettled

  const colour = colourRecord(frameColour)
  const usedProducts = [...new Set(items.map((i) => i.productKey).filter(Boolean))] as string[]
  const colourMismatch =
    colour && colour.products.length > 0 && usedProducts.some((key) => !colour.products.includes(key))
  const colourHasExtra = Boolean(colour?.additionalCharge)
  const alreadySaved = savedQuotes.some((record) => record.quoteNo === quoteNo && record.version === version)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const suggestedSuffix = suggestQuoteSuffix(items)

  function handleClear() {
    if (items.length === 0 || window.confirm('Clear all items on this quote?')) clear()
  }

  function handleSaveQuote() {
    const result = saveCurrentQuote()
    setMessage(
      result.photosOmitted
        ? 'Saved on this browser. Photos were left off this copy because they were too large to store.'
        : 'Saved on this browser. Open it later from Quotes.',
    )
  }

  function handleSubmitForReview() {
    if (!submitForReview()) return
    setMessage('Submitted for office review.')
  }

  function handleIssueQuote() {
    if (
      !window.confirm(
        'Issue this quote? Line items and prices will be locked. Changing the price list later will not change this quote.',
      )
    ) {
      return
    }
    if (!issueQuote()) return
    setMessage('Issued and saved on this browser. Open it later from Quotes.')
  }

  function handleReviseQuote() {
    if (
      !window.confirm(
        'Create a new revision? The issued quote stays in Quotes. This copy unlocks so you can change lines and prices.',
      )
    ) {
      return
    }
    const reason = window.prompt('Why is this quote being revised? (saved on the new revision)')
    if (reason === null) return
    if (!reviseQuote(reason)) return
    setMessage('Revision opened. Previous issued quote is kept in Quotes. Add more notes under the version in Quotes.')
  }

  return (
    <div className="quote-workspace">
      <header className="quote-workspace__header">
        <div>
          <h1>
            Quote {quoteNo}
            {version > 1 ? ` · Rev ${version}` : ''} <QuoteStatusBadge status={status} />
          </h1>
          <p className="muted small">
            {customer.name || 'No customer name yet'} · {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
            {formatCurrency(total)}
          </p>
        </div>
        <Link to="/quotes" className="link-button">
          &larr; All quotes
        </Link>
      </header>

      {dealSettled && (
        <p className={`quote-issued-banner quote-issued-banner--${dealStatus}`}>
          This quote is {dealStatus === 'closed' ? 'closed (deal won)' : 'abandoned'}. Reopen it from Quotes to keep
          editing. Amount paid can still be recorded.
        </p>
      )}
      {issued && !dealSettled && (
        <p className="quote-issued-banner">
          Issued{issuedSnapshot ? ` ${formatIssuedAt(issuedSnapshot.issuedAt)}` : ''}
          {version > 1 ? ` · Rev ${version}` : ''}. Pricing is locked. Choose Revise quote if the customer wants
          changes — the issued copy stays in Quotes. Amount paid can still be recorded.
        </p>
      )}
      {status === 'office-review' && !locked && (
        <p className="quote-issued-banner">This quote is submitted for office review and can still be edited.</p>
      )}

      <div className="quote-workspace__grid">
        <section className="quote-editor quote-workspace__left">
          <h2>Quote details</h2>
          <div className="quote-editor__grid">
            <label>
              Customer
              <input
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="Name"
                disabled={locked}
              />
            </label>
            <label>
              Phone
              <input
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="04xx xxx xxx"
                disabled={locked}
              />
            </label>
            <label className="quote-editor__wide">
              Address
              <textarea
                value={customer.address}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                placeholder={'Street\nSuburb STATE'}
                rows={3}
                disabled={locked}
              />
            </label>
            <label>
              Quote date
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} disabled={locked} />
            </label>
            <label>
              Quote suffix
              <input
                value={quoteSuffix}
                onChange={(e) => setQuoteSuffix(e.target.value)}
                placeholder="SS, DG, IG"
                disabled={locked}
              />
            </label>
            <label>
              Frame colour (default)
              <select value={frameColour} onChange={(e) => setFrameColour(e.target.value)} disabled={locked}>
                {colours.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                    {c.additionalCharge ? ' (extra)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {isOtherFrameColour(frameColour) && (
              <label className="quote-editor__wide">
                Custom colour name
                <input
                  value={customFrameColour}
                  onChange={(e) => setCustomFrameColour(e.target.value)}
                  placeholder="e.g. Stromboli"
                  disabled={locked}
                />
              </label>
            )}
            {colourHasExtra && (
              <label>
                Colour extra $
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={colourExtra}
                  onChange={(e) => setColourExtraOverride(Number(e.target.value) || 0)}
                  disabled={locked}
                />
              </label>
            )}
          </div>

          {suggestedSuffix && suggestedSuffix !== quoteSuffix && !locked && (
            <button type="button" className="link-button" onClick={() => setQuoteSuffix(suggestedSuffix)}>
              Use suggested suffix ({suggestedSuffix})
            </button>
          )}

          {colourHasExtra && !locked && (
            <p className="muted small">
              Default powder-coating extra is {formatCurrency(settings.nonStandardColourPrice)}. You can change it for
              this quote.
            </p>
          )}

          {colourMismatch && (
            <p className="muted small">
              {frameColour} is not listed as available for every product on this quote. Confirm against the colour
              chart before sending.
            </p>
          )}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={shipSameAsBill}
              onChange={(e) => setShipSameAsBill(e.target.checked)}
              disabled={locked}
            />
            Ship To is the same as Bill To
          </label>
          {!shipSameAsBill && (
            <div className="quote-editor__grid">
              <label>
                Ship name
                <input
                  value={shipTo.name}
                  onChange={(e) => setShipTo({ ...shipTo, name: e.target.value })}
                  placeholder="Name"
                  disabled={locked}
                />
              </label>
              <label>
                Ship phone
                <input
                  value={shipTo.phone}
                  onChange={(e) => setShipTo({ ...shipTo, phone: e.target.value })}
                  placeholder="04xx xxx xxx"
                  disabled={locked}
                />
              </label>
              <label className="quote-editor__wide">
                Ship address
                <textarea
                  value={shipTo.address}
                  onChange={(e) => setShipTo({ ...shipTo, address: e.target.value })}
                  placeholder={'Street\nSuburb STATE'}
                  rows={3}
                  disabled={locked}
                />
              </label>
            </div>
          )}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={(e) => setGstEnabled(e.target.checked)}
              disabled={locked}
            />
            Include GST (10%)
          </label>

          <details className="quote-workspace__payment">
            <summary>Payment</summary>
            <label>
              Amount paid
              <input
                type="number"
                min={0}
                step={1}
                value={paid}
                onChange={(e) => setPaid(Number(e.target.value) || 0)}
              />
            </label>
          </details>
        </section>

        <section className="quote-workspace__right">
          <div className="quote-workspace__items">
            {items.length === 0 && <p className="muted">No openings added yet.</p>}
            {items.map((item) => (
              <QuoteItemCard
                key={item.id}
                item={item}
                quoteId={quoteNo}
                quoteFrameColour={frameColour}
                quoteCustomFrameColour={customFrameColour}
                locked={locked}
                onRemove={removeItem}
                onSetQuantity={setQuantity}
              />
            ))}
          </div>

          <Link to={`/quotes/${quoteNo}/items/new`} className="primary-button quote-workspace__add">
            + Add Opening
          </Link>

          <div className="quote-workspace__totals">
            <p>Subtotal: {formatCurrency(subtotal)}</p>
            {gstEnabled && <p>GST: {formatCurrency(gstAmount)}</p>}
            <p className="quote-workspace__total-line">Total: {formatCurrency(total)}</p>
          </div>

          <div className="quote-actions">
            {status === 'draft' && (
              <button
                type="button"
                className="primary-button"
                onClick={handleSubmitForReview}
                disabled={!canSubmitForReview(quote)}
              >
                Submit for Office Review
              </button>
            )}
            {(status === 'draft' || status === 'office-review') && (
              <button
                type="button"
                className={status === 'office-review' ? 'primary-button' : 'secondary-button'}
                onClick={handleIssueQuote}
                disabled={!canIssueQuote(quote)}
              >
                Issue quote
              </button>
            )}
            {status === 'issued' && !dealSettled && (
              <button
                type="button"
                className="primary-button"
                onClick={handleReviseQuote}
                disabled={!canReviseQuote(quote)}
              >
                Revise quote
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPreviewOpen(true)}
              disabled={items.length === 0}
            >
              Preview Customer Quote
            </button>
            <button type="button" className="secondary-button" onClick={handleSaveQuote}>
              {alreadySaved ? 'Update saved quote' : 'Save quote'}
            </button>
            <button type="button" className="link-button" onClick={handleClear} disabled={locked}>
              Clear items
            </button>
            <Link to="/quotes/new" className="link-button">
              New quote
            </Link>
            {message && <span className="muted small">{message}</span>}
          </div>
        </section>
      </div>

      {previewOpen && <QuotePdfPreview onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
