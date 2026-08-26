import { useState } from 'react'
import colours from '../data/colours.json'
import QuoteDocument from '../components/QuoteDocument'
import QuotePdfPreview from '../components/QuotePdfPreview'
import { formatCurrency } from '../lib/formatCurrency'
import { useCompanySettings } from '../lib/companySettings'
import { isOtherFrameColour } from '../lib/frameColour'
import { colourRecord, useQuote } from '../lib/quoteContext'

function formatIssuedAt(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export default function QuoteSummary() {
  const { settings } = useCompanySettings()
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
    status,
    issuedSnapshot,
    saveCurrentQuote,
    issueQuote,
    savedQuotes,
    clear,
    newQuote,
  } = useQuote()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const issued = status === 'issued'

  const colour = colourRecord(frameColour)
  const usedProducts = [...new Set(items.map((i) => i.productKey).filter(Boolean))] as string[]
  const colourMismatch =
    colour && colour.products.length > 0 && usedProducts.some((key) => !colour.products.includes(key))
  const colourHasExtra = Boolean(colour?.additionalCharge)
  const alreadySaved = savedQuotes.some((record) => record.quoteNo === quoteNo)

  function handleClear() {
    if (items.length === 0 || window.confirm('Clear all items on this quote?')) clear()
  }

  function handleNewQuote() {
    if (
      window.confirm(
        'Start a new quote? The current quote on this browser will be replaced. Save it first if you still need it.',
      )
    ) {
      newQuote()
      setSaveMessage(null)
    }
  }

  function handleSaveQuote() {
    const result = saveCurrentQuote()
    setSaveMessage(
      result.photosOmitted
        ? 'Saved on this browser. Photos were left off this copy because they were too large to store.'
        : 'Saved on this browser. Open it later from Saved.',
    )
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
    setSaveMessage('Issued and saved on this browser. Open it later from Saved.')
  }

  return (
    <div className="quote-page">
      {issued && (
        <p className="quote-issued-banner no-print">
          Issued{issuedSnapshot ? ` ${formatIssuedAt(issuedSnapshot.issuedAt)}` : ''}. Pricing is locked. Start a new
          quote to use an updated price list. Amount paid can still be recorded.
        </p>
      )}
      <section className="quote-editor no-print">
        <h1>Quote details</h1>
        <div className="quote-editor__grid">
          <label>
            Customer
            <input
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              placeholder="Name"
              disabled={issued}
            />
          </label>
          <label>
            Phone
            <input
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              placeholder="04xx xxx xxx"
              disabled={issued}
            />
          </label>
          <label className="quote-editor__wide">
            Address
            <textarea
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              placeholder={'Street\nSuburb STATE'}
              rows={3}
              disabled={issued}
            />
          </label>
          <label>
            Quote date
            <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} disabled={issued} />
          </label>
          <label>
            Quote suffix
            <input
              value={quoteSuffix}
              onChange={(e) => setQuoteSuffix(e.target.value)}
              placeholder="SS, DG, IG"
              disabled={issued}
            />
          </label>
          <label>
            Frame colour
            <select value={frameColour} onChange={(e) => setFrameColour(e.target.value)} disabled={issued}>
              {colours.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                  {c.additionalCharge ? ' (extra)' : ''}
                </option>
              ))}
            </select>
          </label>
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
          {isOtherFrameColour(frameColour) && (
            <label className="quote-editor__wide">
              Custom colour name
              <input
                value={customFrameColour}
                onChange={(e) => setCustomFrameColour(e.target.value)}
                placeholder="e.g. Stromboli"
                disabled={issued}
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
                disabled={issued}
              />
            </label>
          )}
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={shipSameAsBill}
            onChange={(e) => setShipSameAsBill(e.target.checked)}
            disabled={issued}
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
                disabled={issued}
              />
            </label>
            <label>
              Ship phone
              <input
                value={shipTo.phone}
                onChange={(e) => setShipTo({ ...shipTo, phone: e.target.value })}
                placeholder="04xx xxx xxx"
                disabled={issued}
              />
            </label>
            <label className="quote-editor__wide">
              Ship address
              <textarea
                value={shipTo.address}
                onChange={(e) => setShipTo({ ...shipTo, address: e.target.value })}
                placeholder={'Street\nSuburb STATE'}
                rows={3}
                disabled={issued}
              />
            </label>
          </div>
        )}
        {colourHasExtra && !issued && (
          <p className="muted small">
            Default powder-coating extra is {formatCurrency(settings.nonStandardColourPrice)}. You can change it for
            this quote.
          </p>
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={gstEnabled}
            onChange={(e) => setGstEnabled(e.target.checked)}
            disabled={issued}
          />
          Include GST (10%)
        </label>
        {colourMismatch && (
          <p className="muted small">
            {frameColour} is not listed as available for every product on this quote. Confirm against the colour
            chart before sending.
          </p>
        )}
      </section>

      <div className="quote-paper">
        <QuoteDocument />
      </div>

      <div className="quote-actions no-print">
        <button
          type="button"
          className="primary-button"
          onClick={() => setPreviewOpen(true)}
          disabled={items.length === 0}
        >
          Save as PDF
        </button>
        <button type="button" className="secondary-button" onClick={handleIssueQuote} disabled={issued || items.length === 0}>
          {issued ? 'Issued' : 'Issue quote'}
        </button>
        <button type="button" className="secondary-button" onClick={handleSaveQuote}>
          {alreadySaved ? 'Update saved quote' : 'Save quote'}
        </button>
        <button type="button" className="secondary-button" onClick={() => window.print()} disabled={items.length === 0}>
          Print quote
        </button>
        <button type="button" className="link-button" onClick={handleClear} disabled={issued}>
          Clear items
        </button>
        <button type="button" className="link-button" onClick={handleNewQuote}>
          New quote
        </button>
        {saveMessage && <span className="muted small">{saveMessage}</span>}
      </div>

      {previewOpen && <QuotePdfPreview onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
