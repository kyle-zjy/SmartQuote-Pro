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
}: {
  item: QuoteLineItem
  onQuantityChange?: (quantity: number) => void
  onDescriptionChange?: (description: string) => void
  onUnitPriceChange?: (unitPrice: number) => void
  onRemove?: () => void
  formatCurrency: (n: number) => string
  readOnly?: boolean
}) {
  return (
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
            {siteDetails(item) && <div className="muted small">{siteDetails(item)}</div>}
            {item.note && <div className="muted small">Note: {item.note}</div>}
          </>
        ) : (
          <>
            <textarea
              className="desc-input"
              rows={2}
              value={item.description}
              onChange={(e) => onDescriptionChange?.(e.target.value)}
            />
            {siteDetails(item) && <div className="muted small">{siteDetails(item)}</div>}
            {item.note && <div className="muted small">Note: {item.note}</div>}
          </>
        )}
      </td>
      <td className="quote-sheet__price">
        {readOnly ? (
          formatCurrency(item.unitPrice)
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={item.unitPrice}
            onChange={(e) => onUnitPriceChange?.(Number(e.target.value))}
            className="price-input"
          />
        )}
      </td>
      <td className="quote-sheet__price">{formatCurrency(lineAmount(item.unitPrice, item.quantity))}</td>
      {!readOnly && (
        <td className="no-print">
          <button type="button" className="link-button" onClick={onRemove}>
            Remove
          </button>
        </td>
      )}
    </tr>
  )
}
