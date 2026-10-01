import { customerQuoteNote, productPrice, quoteExtras, extraLabel, type QuoteAudience } from '../lib/quotePrint'
import type { QuoteLineItem } from '../lib/quoteContext'
import { lineAmount } from '../lib/quoteTotals'

function siteDetails(item: QuoteLineItem): string {
  return [
    item.lockHeightMm ? `Lock height: ${item.lockHeightMm} mm` : '',
    item.lockSide ? `Lock side: ${item.lockSide}` : '',
    item.centreTongue ? 'Centre tongue' : '',
    item.bowed ? 'Door bowed' : '',
  ].filter(Boolean).join(' · ')
}

export default function QuoteLineItemRow({
  item,
  onQuantityChange,
  onDescriptionChange,
  onUnitPriceChange,
  onRemove,
  formatCurrency,
  readOnly = false,
  audience = 'customer',
}: {
  item: QuoteLineItem
  onQuantityChange?: (quantity: number) => void
  onDescriptionChange?: (description: string) => void
  onUnitPriceChange?: (unitPrice: number) => void
  onRemove?: () => void
  formatCurrency: (n: number) => string
  readOnly?: boolean
  audience?: QuoteAudience
}) {
  const customerNote = customerQuoteNote(item)
  const extras = quoteExtras(item)
  const basePrice = productPrice(item)
  const details = (
    <>
      {audience === 'customer' && customerNote && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>Customer notes: {customerNote}</div>}
      {audience === 'factory' && (
        <>
          {item.configurationCode && <div className="small">Configuration: {item.configurationCode}</div>}
          {item.measurements && Object.keys(item.measurements).length > 0 && (
            <div className="small">Measurements: {Object.entries(item.measurements).map(([key, value]) => `${key}: ${value}`).join(' · ')}</div>
          )}
          {siteDetails(item) && <div className="muted small">{siteDetails(item)}</div>}
          {item.note && <div className="muted small">Production notes: {item.note}</div>}
        </>
      )}
    </>
  )
  return (
    <>
    <tr>
      <td className="quote-sheet__qty">
        {readOnly ? (
          item.quantity
        ) : (
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onQuantityChange?.(Number(e.target.value))}
            className="qty-input"
          />
        )}
      </td>
      <td>
        {readOnly ? (
          <>
            <div>{item.description}</div>
            {details}
          </>
        ) : (
          <>
            <textarea
              className="desc-input"
              rows={2}
              value={item.description}
              onChange={(e) => onDescriptionChange?.(e.target.value)}
            />
            {details}
          </>
        )}
      </td>
      <td className="quote-sheet__price">
        {readOnly ? (
          formatCurrency(basePrice)
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={basePrice}
            onChange={(e) => onUnitPriceChange?.(Number(e.target.value) + extras.reduce((sum, extra) => sum + extra.price, 0))}
            className="price-input"
          />
        )}
      </td>
      <td className="quote-sheet__price">{formatCurrency(lineAmount(basePrice, item.quantity))}</td>
      {!readOnly && (
        <td className="no-print">
          <button type="button" className="link-button" onClick={onRemove}>
            Remove
          </button>
        </td>
      )}
    </tr>
    {extras.map((extra, index) => (
      <tr key={`${extra.name}-${index}`} className="quote-sheet__extra">
        <td className="quote-sheet__qty">{item.quantity}</td>
        <td>Extra — {extraLabel(extra.name)}</td>
        <td className="quote-sheet__price">{formatCurrency(extra.price)}</td>
        <td className="quote-sheet__price">{formatCurrency(lineAmount(extra.price, item.quantity))}</td>
        {!readOnly && <td className="no-print" />}
      </tr>
    ))}
    </>
  )
}
