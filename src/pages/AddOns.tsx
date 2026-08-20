import { useMemo } from 'react'
import type { AddonItem } from '../types/pricing'
import { formatCurrency } from '../lib/formatCurrency'
import { useQuote } from '../lib/quoteContext'
import { usePricing } from '../lib/pricingContext'

export default function AddOns() {
  const { addItem } = useQuote()
  const { addons: data } = usePricing()

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
