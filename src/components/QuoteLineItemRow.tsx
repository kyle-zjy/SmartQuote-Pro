import type { QuoteLineItem } from '../lib/quoteContext'

export default function QuoteLineItemRow({
  item,
  onQuantityChange,
  onRemove,
  formatCurrency,
}: {
  item: QuoteLineItem
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  formatCurrency: (n: number) => string
}) {
  return (
    <tr>
      <td>
        <div>{item.description}</div>
        <div className="muted small">{item.detail}</div>
      </td>
      <td>
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onQuantityChange(Number(e.target.value))}
          className="qty-input"
        />
      </td>
      <td>{formatCurrency(item.unitPrice)}</td>
      <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
      <td>
        <button type="button" className="link-button" onClick={onRemove}>
          Remove
        </button>
      </td>
    </tr>
  )
}
