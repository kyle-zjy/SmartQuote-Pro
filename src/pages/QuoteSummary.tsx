import { useMemo } from 'react'
import { useQuote, type QuoteLineItem } from '../lib/quoteContext'
import { formatCurrency } from '../lib/formatCurrency'
import QuoteLineItemRow from '../components/QuoteLineItemRow'
import RoomPhotos from '../components/RoomPhotos'
import { ROOM_TYPES } from '../lib/roomTypes'

const UNASSIGNED = 'Unassigned'
const ROOM_ORDER = [...ROOM_TYPES, UNASSIGNED]

export default function QuoteSummary() {
  const { items, gstEnabled, setGstEnabled, removeItem, setQuantity, clear, subtotal, gstAmount, total } = useQuote()

  const groups = useMemo(() => {
    const map = new Map<string, QuoteLineItem[]>()
    for (const item of items) {
      const key = item.room && item.room.trim() ? item.room : UNASSIGNED
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()].sort((a, b) => ROOM_ORDER.indexOf(a[0]) - ROOM_ORDER.indexOf(b[0]))
  }, [items])

  return (
    <div>
      <h1>Your quote</h1>

      {items.length === 0 ? (
        <p className="muted">No items yet. Add a product from the calculator to build a quote.</p>
      ) : (
        <>
          {groups.map(([room, roomItems]) => (
            <div key={room} className="quote-room-section">
              <h2>{room}</h2>
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
                  {roomItems.map((item) => (
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
              <RoomPhotos room={room} />
            </div>
          ))}

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
