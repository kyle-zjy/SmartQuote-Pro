import { useQuote } from '../lib/quoteContext'
import { formatCurrency } from '../lib/formatCurrency'
import QuoteLineItemRow from '../components/QuoteLineItemRow'

export default function QuoteSummary() {
  const { items, gstEnabled, setGstEnabled, removeItem, setQuantity, clear, subtotal, gstAmount, total } = useQuote()

  return (
    <div>
      <h1>Your quote</h1>

      {items.length === 0 ? (
        <p className="muted">No items yet. Add a product from the calculator to build a quote.</p>
      ) : (
        <>
          <table className="quote-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <QuoteLineItemRow
                  key={item.id}
                  item={item}
                  onQuantityChange={(q) => setQuantity(item.id, q)}
                  onRemove={() => removeItem(item.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </tbody>
          </table>

          <div className="quote-totals">
            <label className="checkbox-row">
              <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} />
              Include GST (10%)
            </label>
            <div className="totals-grid">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
              <span>GST</span>
              <span>{formatCurrency(gstAmount)}</span>
              <span className="totals-grid__total">Total</span>
              <span className="totals-grid__total">{formatCurrency(total)}</span>
            </div>
          </div>

          <button type="button" className="link-button" onClick={clear}>
            Clear quote
          </button>
        </>
      )}
    </div>
  )
}
