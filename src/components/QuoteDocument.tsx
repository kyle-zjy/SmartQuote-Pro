import { productWarrantyNotes } from '../data/company'
import { useCompanySettings } from '../lib/companySettings'
import { displayFrameColour } from '../lib/frameColour'
import { displayQuoteNo, displayQuoteRevision } from '../lib/displayQuoteNo'
import { useQuote } from '../lib/quoteContext'
import { formatCurrency } from '../lib/formatCurrency'
import { partyLines } from '../lib/partyLines'
import QuoteLineItemRow from './QuoteLineItemRow'
import RoomPhotos from './RoomPhotos'
import goldcoHeader from '../assets/goldco-header.png'
import goldcoBadges from '../assets/goldco-badges.jpg'

function formatQuoteDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export default function QuoteDocument({ readOnly = false }: { readOnly?: boolean }) {
  const { settings } = useCompanySettings()
  const {
    items,
    removeItem,
    setQuantity,
    updateItem,
    customer,
    shipSameAsBill,
    shipTo,
    quoteNo,
    quoteSuffix,
    quoteDate,
    version,
    frameColour,
    customFrameColour,
    colourExtra,
    subtotal,
    gstAmount,
    total,
    deposit,
    paid,
    balance,
    status,
    dealStatus,
    issuedSnapshot,
  } = useQuote()

  const linesLocked = readOnly || status === 'issued' || dealStatus !== 'open'

  const billLines = partyLines(customer.name, customer.address, customer.phone)
  const shipParty = shipSameAsBill ? customer : shipTo
  const shipLines = partyLines(shipParty.name, shipParty.address, shipParty.phone)
  const warrantyNotes = productWarrantyNotes(items.map((item) => item.productKey ?? ''))
  const rooms = [...new Set(items.map((item) => (item.room && item.room.trim() ? item.room : 'Unassigned')))]

  return (
    <article className={readOnly ? 'quote-doc quote-doc--preview' : 'quote-doc'}>
      <header className="quote-doc__masthead">
        <div className="quote-doc__brand">
          <div className="quote-doc__logo-clip">
            <img className="quote-doc__logo" src={goldcoHeader} alt={settings.name} />
          </div>
          <p className="quote-doc__legal">
            ABN: {settings.abn}
            &nbsp;&nbsp;QBCC: {settings.qbcc}
          </p>
          <p className="quote-doc__legal">
            {settings.address}; {settings.phone}
          </p>
        </div>
        <img className="quote-doc__badges" src={goldcoBadges} alt="" />
      </header>

      <div className="quote-doc__parties">
        <h1>Quote</h1>
        <div className="quote-doc__meta">
          <p>Date: {formatQuoteDate(quoteDate)}</p>
          <p className="quote-doc__no">
            Quote No: {displayQuoteNo(quoteNo, quoteSuffix)}
            {version > 1 ? ` · ${displayQuoteRevision(version)}` : ''}
          </p>
          {status === 'issued' && <p>Status: Issued</p>}
        </div>
        <div className="quote-party">
          <div className="quote-party__label">Bill To:</div>
          <div className="quote-party__body">
            {billLines.map((line, index) => (
              <p key={`bill-${index}`}>{line}</p>
            ))}
          </div>
        </div>
        <div className="quote-party">
          <div className="quote-party__label">Ship To:</div>
          <div className="quote-party__body">
            {shipLines.map((line, index) => (
              <p key={`ship-${index}`}>{line}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="quote-sheet-wrap">
        <table className="quote-sheet">
          <colgroup>
            <col className="quote-sheet__col-qty" />
            <col className="quote-sheet__col-desc" />
            <col className="quote-sheet__col-price" />
            <col className="quote-sheet__col-price" />
            {!linesLocked && <col className="quote-sheet__col-actions" />}
          </colgroup>
          <thead>
            <tr>
              <th>QTY</th>
              <th>DESCRIPTION</th>
              <th>UNIT PRICE</th>
              <th>TOTAL PRICE</th>
              {!linesLocked && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td />
              <td>
                Supply &amp; Install
                <br />
                Frame Colour: {displayFrameColour(frameColour, customFrameColour)}
              </td>
              <td />
              <td />
              {!linesLocked && <td className="no-print" />}
            </tr>
            {items.length === 0 ? (
              <tr>
                <td />
                <td className="muted">No items yet. Add a product from the calculator to build a quote.</td>
                <td />
                <td />
                {!linesLocked && <td className="no-print" />}
              </tr>
            ) : (
              items.map((item) => (
                <QuoteLineItemRow
                  key={item.id}
                  item={item}
                  readOnly={linesLocked}
                  onQuantityChange={linesLocked ? undefined : (q) => setQuantity(item.id, q)}
                  onDescriptionChange={linesLocked ? undefined : (description) => updateItem(item.id, { description })}
                  onUnitPriceChange={linesLocked ? undefined : (unitPrice) => updateItem(item.id, { unitPrice })}
                  onRemove={linesLocked ? undefined : () => removeItem(item.id)}
                  formatCurrency={formatCurrency}
                />
              ))
            )}
            {colourExtra > 0 && (
              <tr>
                <td>1</td>
                <td>Powder coating for non-standard colour</td>
                <td className="quote-sheet__price">{formatCurrency(colourExtra)}</td>
                <td className="quote-sheet__price">{formatCurrency(colourExtra)}</td>
                {!linesLocked && <td className="no-print" />}
              </tr>
            )}
            {items.length > 0 && (
              <tr className="quote-sheet__notes">
                <td />
                <td>
                  <p>
                    **** TO PROCEED **** A minimum {Math.round((issuedSnapshot?.depositRate ?? settings.depositRate) * 100)}% confirmed deposit is
                    required of {formatCurrency(deposit)}
                  </p>
                  <p>{settings.licensing}</p>
                  {warrantyNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  <p>**** Warranty and Care &amp; Maintenance details ****</p>
                  <p>Warranty — {settings.warrantyUrl}</p>
                  <p>Care &amp; Maintenance — {settings.careUrl}</p>
                </td>
                <td />
                <td />
                {!linesLocked && <td className="no-print" />}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="quote-sheet-foot">
        <div className="quote-sheet-foot__terms">
          <p className="quote-sheet-foot__contract">{settings.termsContract}</p>
          <p className="quote-sheet-foot__sizes">{settings.sizeDisclaimer}</p>
        </div>
        <div className="quote-sheet-foot__totals">
          <span>Sale Amt</span>
          <span>{formatCurrency(subtotal)}</span>
          <span>GST</span>
          <span>{formatCurrency(gstAmount)}</span>
          <span>Paid</span>
          <span>{formatCurrency(paid)}</span>
          <span>Total Amt</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <div className="quote-sheet-foot__valid">
          <p>This Quote Valid for {settings.validityDays} Days*</p>
          <p className="quote-sheet-foot__tnc">*Subject to T&amp;Cs</p>
        </div>
        <div className="quote-sheet-foot__balance">
          <span>Balance Due</span>
          <span>{formatCurrency(balance)}</span>
        </div>
      </div>

      <div className="quote-doc__bank">
        <p>
          Bank Details: {settings.bank.name} &nbsp;&nbsp; BSB: {settings.bank.bsb} &nbsp;&nbsp; ACC:{' '}
          {settings.bank.account}
        </p>
        <p>Please use your quote number as the reference for all payments</p>
        <p className="quote-doc__fee">
          Please Note: Any credit card payments will incur a {settings.cardFeePercent}% processing fee
        </p>
      </div>

      {!readOnly && rooms.length > 0 && (
        <div className="no-print quote-doc__photos">
          {rooms.map((room) => (
            <div key={room}>
              <h2>{room}</h2>
              <RoomPhotos room={room} />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
