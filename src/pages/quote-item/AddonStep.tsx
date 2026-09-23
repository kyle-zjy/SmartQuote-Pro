import { useMemo, useState } from 'react'
import type { AddonItem } from '../../types/pricing'
import { formatCurrency } from '../../lib/formatCurrency'
import { usePricing } from '../../lib/pricingContext'
import type { ItemDraft } from './itemDraft'

export default function AddonStep({
  draft,
  contextLabel,
  onChange,
  onNext,
  onBack,
}: {
  draft: ItemDraft
  contextLabel: string
  onChange: (patch: Partial<ItemDraft>) => void
  onNext: () => void
  onBack: () => void
}) {
  const { addons: data } = usePricing()
  const [requestPrices, setRequestPrices] = useState<Record<string, string>>({})

  const sections = useMemo(() => {
    const map = new Map<string, AddonItem[]>()
    for (const item of data) {
      const key = item.section ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data])

  const selectedNames = new Set(draft.addons.map((a) => a.name))

  function toggle(item: AddonItem, unitPrice: number) {
    if (selectedNames.has(item.name)) {
      onChange({ addons: draft.addons.filter((a) => a.name !== item.name) })
    } else {
      onChange({ addons: [...draft.addons, { name: item.name, price: unitPrice }] })
    }
  }

  return (
    <div className="wizard-panel">
      <h2>Add-ons</h2>
      <p className="muted">For {contextLabel}</p>
      {/* TODO(compat): no add-on/product compatibility data exists yet, so the full catalog is
          shown for every opening. Revisit if/when that compatibility data becomes available. */}

      {[...sections.entries()].map(([section, sectionItems]) => (
        <div key={section} className="addon-section">
          <h3>{section}</h3>
          <table className="quote-table">
            <thead>
              <tr>
                <th />
                <th>Item</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {sectionItems.map((item) => {
                const typed = requestPrices[item.name]
                const typedPrice = Number(typed)
                const unitPrice = item.priceOnRequest ? typedPrice : (item.price ?? 0)
                const isSelected = selectedNames.has(item.name)
                const canToggle = item.priceOnRequest
                  ? isSelected || (Boolean(typed) && !Number.isNaN(typedPrice) && typedPrice >= 0)
                  : item.price !== null && item.price !== undefined
                return (
                  <tr key={item.name}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canToggle}
                        onChange={() => toggle(item, unitPrice)}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>
                      {item.priceOnRequest ? (
                        isSelected ? (
                          formatCurrency(draft.addons.find((a) => a.name === item.name)?.price ?? 0)
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className="price-input"
                            placeholder="Enter price"
                            value={typed ?? ''}
                            onChange={(e) =>
                              setRequestPrices((current) => ({ ...current, [item.name]: e.target.value }))
                            }
                          />
                        )
                      ) : (
                        formatCurrency(item.price ?? 0)
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
        <button type="button" className="primary-button" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  )
}
