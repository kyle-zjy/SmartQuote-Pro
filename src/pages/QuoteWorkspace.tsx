import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { quoteIdFromPath } from '../lib/quoteRoute'
import colours from '../data/colours.json'
import QuotePdfPreview from '../components/QuotePdfPreview'
import QuoteRoomGroup from '../components/QuoteRoomGroup'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import QuoteDiscountFields from '../components/QuoteDiscountFields'
import { useCompanySettings } from '../lib/companySettings'
import { formatCurrency } from '../lib/formatCurrency'
import { removeQuoteExtra } from '../lib/quotePrint'
import { groupQuoteItemsByLocation } from '../lib/groupQuoteItems'
import { isOtherFrameColour } from '../lib/frameColour'
import { canReviseQuote, canSubmitForReview } from '../lib/quoteLifecycle'
import { colourRecord, useQuote } from '../lib/quoteContext'
import { useAuth } from '../lib/authContext'
import { getReview } from '../lib/reviewStore'
import { reviewMatchesQuote } from '../lib/quoteReview'
import { findStaff } from '../lib/staffStore'
import { SERVER_MODE } from '../lib/apiClient'
import { STEP_LABELS } from './quote-item/wizardSteps'
import {
  clearWizardDraft,
  isFromWizardNav,
  listWizardDrafts,
  wizardDraftPath,
  WIZARD_DRAFT_KIND_LABELS,
  type WizardDraftKey,
} from './quote-item/wizardDraftStore'

function formatIssuedAt(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export default function QuoteWorkspace() {
  const navigate = useNavigate()
  const location = useLocation()
  const id = quoteIdFromPath(location.pathname)
  const { settings } = useCompanySettings()
  const quote = useQuote()
  const {
    items,
    customer,
    frameColour,
    setFrameColour,
    customFrameColour,
    setCustomFrameColour,
    colourExtra,
    setColourExtraOverride,
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
    saveAsSeparateQuote,
    submitForReview,
    issueQuote,
    canIssue,
    reviseQuote,
    removeItem,
    setQuantity,
    updateItem,
    loadSavedQuote,
    clear,
  } = quote

  const [previewAudience, setPreviewAudience] = useState<'customer' | 'factory' | null>(null)
  const [discountValid, setDiscountValid] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [wizardDrafts, setWizardDrafts] = useState(() => listWizardDrafts(quoteNo))
  const { isAdmin } = useAuth()
  const [reviewTick, setReviewTick] = useState(0)

  const issued = status === 'issued'
  const dealSettled = dealStatus !== 'open'
  const locked = issued || dealSettled || !quote.canEdit

  useEffect(() => {
    setWizardDrafts(listWizardDrafts(quoteNo))
  }, [quoteNo])

  // Coming back to a quote from anywhere else (Quotes list, the Current Quote nav link, a pasted
  // URL) drops the user straight back into their unfinished opening. Leaving the wizard on purpose
  // sets fromWizard, which keeps them here with the resume banner instead. Replacing rather than
  // pushing matters: a pushed entry would send the browser Back button into this same redirect.
  useEffect(() => {
    if (locked || id !== quoteNo) return
    if (isFromWizardNav(location.state)) return
    const [newest] = listWizardDrafts(quoteNo)
    if (!newest) return
    navigate(wizardDraftPath(newest.key), { replace: true })
  }, [id, quoteNo, locked, location.state, navigate])

  useEffect(() => {
    if (id && id !== quoteNo) {
      const hasDraft = items.length > 0 || Boolean(customer.name.trim())
      if (hasDraft) {
        const ok = window.confirm(
          'Open this saved quote? The quote you are editing now will be replaced. Save it first if you still need it.',
        )
        if (!ok) {
          navigate(`/quotes/${encodeURIComponent(quoteNo ?? "")}`, { replace: true })
          return
        }
      }
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

  const colour = colourRecord(frameColour)
  const usedProducts = [...new Set(items.map((i) => i.productKey).filter(Boolean))] as string[]
  const colourMismatch =
    colour && colour.products.length > 0 && usedProducts.some((key) => !colour.products.includes(key))
  const colourHasExtra = Boolean(colour?.additionalCharge)
  const alreadySaved = savedQuotes.some((record) => record.quoteNo === quoteNo && record.version === version)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const roomGroups = groupQuoteItemsByLocation(items)
  void reviewTick
  const review = locked ? undefined : getReview(quoteNo, version || 1)
  const reviewChanged = Boolean(review && !reviewMatchesQuote(review, quote, { colourExtra, depositRate: settings.depositRate }))
  const reviewer = review?.reviewedBy ? findStaff(review.reviewedBy) : undefined

  function handleClear() {
    if (items.length === 0 || window.confirm('Clear all items on this quote?')) clear()
  }

  function handleDiscardWizardDraft(key: WizardDraftKey) {
    if (locked) return
    if (!window.confirm('Discard this unsaved opening? Any changes on it will be lost.')) return
    clearWizardDraft(key)
    setWizardDrafts(listWizardDrafts(quoteNo))
  }

  async function handleSaveQuote() {
    try {
      const result = await saveCurrentQuote()
      setMessage(
        result.photosOmitted
          ? 'Saved on this browser. Photos were left off this copy because they were too large to store.'
          : SERVER_MODE ? 'Saved to the shared workspace. Open it from Quotes in any connected browser.' : 'Saved on this browser. Open it later from Quotes.',
      )
    } catch {
      setMessage('Could not save this quote. Your edits are still here. Free up browser storage and try again.')
    }
  }

  async function handleSubmitForReview() {
    if (!await submitForReview()) {
      setMessage('Could not submit. Check the customer, site address and items, and make sure browser storage is available.')
      return
    }
    setReviewTick((t) => t + 1)
    setMessage('Submitted for office review.')
  }

  async function handleResubmit() {
    if (!await submitForReview()) {
      setMessage('Could not resubmit. Check the customer, site address and items, and make sure browser storage is available.')
      return
    }
    setReviewTick((t) => t + 1)
    setMessage('Resubmitted for office review.')
  }

  async function handleSaveAsSeparateQuote() {
    try {
      const result = await saveAsSeparateQuote()
      navigate(`/quotes/${encodeURIComponent(result.record.quoteNo ?? "")}`, { replace: true })
      setMessage(
        result.photosOmitted
          ? `Saved as separate quote ${result.record.quoteNo}. The original saved quote is unchanged. Photos were too large to store in the saved copy.`
          : `Saved as separate quote ${result.record.quoteNo}. The original saved quote is unchanged.`,
      )
    } catch {
      setMessage('Could not save a separate quote. Your edits are still here. Free up browser storage and try again.')
    }
  }

  async function handleIssueQuote() {
    if (
      !window.confirm(
        'Issue this quote? Line items and prices will be locked. Changing the price list later will not change this quote.',
      )
    ) {
      return
    }
    if (!await issueQuote()) {
      setMessage('Could not issue. Staff need approval for the current quote, and the issued copy must be saved successfully.')
      return
    }
    setMessage(SERVER_MODE ? 'Issued and saved to the shared workspace.' : 'Issued and saved on this browser. Open it later from Quotes.')
  }

  async function handleReviseQuote() {
    if (
      !window.confirm(
        'Create a new revision? The issued quote stays in Quotes. This copy unlocks so you can change lines and prices.',
      )
    ) {
      return
    }
    const reason = window.prompt('Why is this quote being revised? (saved on the new revision)')
    if (reason === null) return
    if (!await reviseQuote(reason)) {
      setMessage('Could not save the revision. The issued quote is still here. Check browser storage and try again.')
      return
    }
    setMessage('Revision opened. Previous issued quote is kept in Quotes. Add more notes under the version in Quotes.')
  }

  return (
    <div className="quote-workspace">
      {quote.archiveStorageError && <p role="alert">{quote.archiveStorageError}</p>}
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

      {!quote.canEdit && <div className="quote-issued-banner" role="status">
        <p>{quote.editPending ? 'Checking editing access…' : 'This quote is open in another tab. This tab is read-only to protect your edits.'}</p>
        {!quote.editPending && <button type="button" className="secondary-button" onClick={quote.retryEditing}>Edit in this tab</button>}
      </div>}
      {dealSettled && (
        <p className={`quote-issued-banner quote-issued-banner--${dealStatus}`}>
          This quote is {dealStatus === 'closed' ? 'closed (deal won)' : 'abandoned'}. Reopen it from Quotes to keep
          editing.
        </p>
      )}
      {issued && !dealSettled && (
        <p className="quote-issued-banner">
          Issued{issuedSnapshot ? ` ${formatIssuedAt(issuedSnapshot.issuedAt)}` : ''}
          {version > 1 ? ` · Rev ${version}` : ''}. Pricing is locked. Choose Revise quote if the customer wants
          changes — the issued copy stays in Quotes.
        </p>
      )}
      {issued && !issuedSnapshot?.document && <p className="quote-issued-banner">
        This older issued quote has no saved company and terms snapshot. Its document uses current company details.
      </p>}
      {quote.photoStorageError && <div className="quote-issued-banner" role="alert">
        <p>{quote.photoStorageError}</p>
        <button type="button" className="secondary-button" onClick={quote.retryPhotoStorage}>Retry photo storage</button>
      </div>}
      {!reviewChanged && ((status === 'office-review' && !review) || review?.status === 'pending') && (
        <p className="quote-issued-banner">This quote is submitted for office review and can still be edited.</p>
      )}
      {reviewChanged && review?.status !== 'returned' && (
        <p className="quote-issued-banner" role="alert">This quote has changed since submission. Resubmit it for office review before staff can issue it.</p>
      )}
      {!reviewChanged && review?.status === 'approved' && (
        <p className="quote-issued-banner quote-review-banner--approved">
          Approved by {reviewer?.name ?? 'the office'}
          {review.reviewNote ? `: ${review.reviewNote}` : '.'} Ready to issue.
        </p>
      )}
      {review?.status === 'returned' && (
        <p className="quote-issued-banner quote-review-banner--returned" role="alert">
          Returned by {reviewer?.name ?? 'the office'}: {review.reviewNote ?? 'changes needed.'} Make the changes, then
          choose Resubmit for review.
        </p>
      )}

      {wizardDrafts.length > 0 && (
        <div className="wizard-resume-banner">
          {wizardDrafts.map(({ key, snapshot }) => (
            <div className="wizard-resume-banner__row" key={`${key.kind}:${key.refId ?? ''}`}>
              <span>
                {WIZARD_DRAFT_KIND_LABELS[key.kind]}
                {snapshot.draft.location ? ` — "${snapshot.draft.location}"` : ''} · {STEP_LABELS[snapshot.step]} step
              </span>
              <Link to={wizardDraftPath(key)} className="link-button">
                Resume
              </Link>
              <button type="button" className="link-button" disabled={locked} onClick={() => handleDiscardWizardDraft(key)}>
                Discard
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="quote-workspace__grid">
        <section className="quote-editor quote-workspace__left">
          <h2>Quote settings</h2>
          <div className="quote-editor__grid">
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

          <div className="quote-editor__grid">
            <QuoteDiscountFields key={`${quoteNo}:${version}`} value={quote.discount}
              onChange={(discount) => { if (!locked) quote.setDiscount(discount) }}
              onValidityChange={setDiscountValid} disabled={locked} />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={(e) => setGstEnabled(e.target.checked)}
              disabled={locked}
            />
            Include GST (10%)
          </label>
        </section>

        <section className="quote-workspace__right">
          <div className="quote-workspace__items">
            {items.length === 0 && (
              <div className="empty-state empty-state--inline">
                <p className="empty-state__title">No openings added yet</p>
                <p className="muted">Add the first door or window to start building this quote.</p>
              </div>
            )}
            {roomGroups.map((group) => (
              <QuoteRoomGroup
                key={group.location}
                group={group}
                quoteId={quoteNo}
                quoteFrameColour={frameColour}
                quoteCustomFrameColour={customFrameColour}
                locked={locked}
                onRemove={removeItem}
                onSetQuantity={setQuantity}
                onRemoveExtra={(id, name) => {
                  const item = items.find((candidate) => candidate.id === id)
                  if (!locked && item) updateItem(id, removeQuoteExtra(item, name))
                }}
                onOverridePrice={(id, finalPrice) => updateItem(id, { finalPrice, priceOverridden: true })}
              />
            ))}
          </div>

          {locked ? (
            <>
              <button type="button" className="primary-button quote-workspace__add" disabled>
                + Add Opening
              </button>
              <button type="button" className="primary-button quote-workspace__add" disabled>
                + Add Extra / Repair
              </button>
              <p className="muted small quote-workspace__add-hint">
                {dealSettled
                  ? 'Reopen this quote from Quotes to add or change openings.'
                  : 'Revise this quote to add or change openings.'}
              </p>
            </>
          ) : (
            <>
              <Link to={`/quotes/${encodeURIComponent(quoteNo ?? "")}/items/new`} className="primary-button quote-workspace__add">
                + Add Opening
              </Link>
              <Link to={`/quotes/${encodeURIComponent(quoteNo ?? "")}/items/new?service=1`} className="primary-button quote-workspace__add">
                + Add Extra / Repair
              </Link>
            </>
          )}

          <div className="quote-workspace__totals">
            {quote.discountPercent > 0 && <>
              <p>Before discount: {formatCurrency(quote.subtotalBeforeDiscount)}</p>
              <p>Discount ({quote.discountPercent}%): −{formatCurrency(quote.discountAmount)}</p>
            </>}
            <p>Subtotal: {formatCurrency(subtotal)}</p>
            {gstEnabled && <p>GST: {formatCurrency(gstAmount)}</p>}
            <p className="quote-workspace__total-line">Total: {formatCurrency(total)}</p>
          </div>

          <div className="quote-actions">
            {status === 'draft' && review?.status !== 'returned' && (
              <button
                type="button"
                className="primary-button"
                onClick={handleSubmitForReview}
                disabled={!discountValid || !quote.canEdit || !canSubmitForReview(quote)}
              >
                Submit for Office Review
              </button>
            )}
            {(review?.status === 'returned' || reviewChanged || (status === 'office-review' && !review)) && !locked && (
              <button type="button" className="primary-button" disabled={!discountValid || !quote.canEdit} onClick={handleResubmit}>
                Resubmit for review
              </button>
            )}
            {(status === 'draft' || status === 'office-review') && (
              <button
                type="button"
                className={status === 'office-review' ? 'primary-button' : 'secondary-button'}
                onClick={handleIssueQuote}
                disabled={!discountValid || !canIssue}
              >
                Issue quote
              </button>
            )}
            {!isAdmin && !locked && !canIssue && <span className="muted small">Office approval is required before issuing.</span>}
            {status === 'issued' && !dealSettled && (
              <button
                type="button"
                className="primary-button"
                onClick={handleReviseQuote}
                disabled={!quote.canEdit || !canReviseQuote(quote)}
              >
                Revise quote
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPreviewAudience('customer')}
              disabled={!discountValid || items.length === 0}
            >
              Preview Customer Quote
            </button>
            <button type="button" className="secondary-button" onClick={() => setPreviewAudience('factory')} disabled={!discountValid || items.length === 0}>
              Preview Factory Quote
            </button>
            <button type="button" className="secondary-button" disabled={!discountValid || !quote.canEdit} onClick={handleSaveQuote}>
              {alreadySaved ? 'Update saved quote' : 'Save quote'}
            </button>
            {!locked && (
              <button type="button" className="secondary-button" disabled={!discountValid} onClick={handleSaveAsSeparateQuote}>
                Save as separate quote
              </button>
            )}
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

      {previewAudience && <QuotePdfPreview audience={previewAudience} onClose={() => setPreviewAudience(null)} />}
    </div>
  )
}
