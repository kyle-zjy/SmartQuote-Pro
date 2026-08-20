import { useMemo, useState } from 'react'
import type { AddonItem } from '../types/pricing'
import { formatCurrency } from '../lib/formatCurrency'
import { useQuote } from '../lib/quoteContext'
import { usePricing } from '../lib/pricingContext'
import { ROOM_TYPES } from '../lib/roomTypes'

const OTHER_ROOM = 'Other'

export default function AddOns() {
  const { addItem } = useQuote()
  const { addons: data } = usePricing()
  const [room, setRoom] = useState(ROOM_TYPES[0])
  const [customRoom, setCustomRoom] = useState('')
  const [note, setNote] = useState('')
  const resolvedRoom = room === OTHER_ROOM && customRoom.trim() ? customRoom.trim() : room

  const sections = useMemo(() => {
    const map = new Map<string, AddonItem[]>()
    for (const item of data) {
      const key = item.section ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data])

  return (
    <div>
      <h1>Add-ons &amp; extras</h1>
      <p className="muted">Flat-rate items that can be added to any quote.</p>

      <div className="field-row">
        <label className="field-row__single">
          Room
          <select
            value={room}
            onChange={(e) => {
              setRoom(e.target.value)
              if (e.target.value !== OTHER_ROOM) setCustomRoom('')
            }}
          >
            {ROOM_TYPES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {room === OTHER_ROOM && (
          <label className="field-row__single">
            Room name
            <input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              placeholder="e.g. Sunroom"
            />
          </label>
        )}
        <label className="field-row__single">
          Notes (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any remarks for these items"
            rows={2}
          />
        </label>
      </div>

      {[...sections.entries()].map(([section, sectionItems]) => (
        <div key={section} className="addon-section">
          <h2>{section}</h2>
          <table className="quote-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sectionItems.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.priceOnRequest ? 'Price on request' : formatCurrency(item.price ?? 0)}</td>
                  <td>
                    {!item.priceOnRequest && item.price !== null && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          addItem({
                            description: item.name,
                            detail: item.unit ?? '',
                            quantity: 1,
                            unitPrice: item.price!,
                            room: resolvedRoom,
                            note: note.trim(),
                          })
                        }
                      >
                        Add to quote
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
