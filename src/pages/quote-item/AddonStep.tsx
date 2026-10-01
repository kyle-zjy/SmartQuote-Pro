import { useMemo } from 'react'
import colours from '../../data/colours.json'
import type { AddonItem } from '../../types/pricing'
import { calcConfiguredPrice, DOUBLE_HUNG_SURCHARGE, STANDARD_MESH } from '../../lib/configuredPrice'
import { displayFrameColour } from '../../lib/frameColour'
import { formatCurrency } from '../../lib/formatCurrency'
import { usePricing } from '../../lib/pricingContext'
import type { ItemDraft } from './itemDraft'

export default function AddonStep({
  draft,
  contextLabel,
  quoteFrameColour,
  quoteCustomFrameColour,
  onChange,
  onNext,
  onBack,
}: {
  draft: ItemDraft
  contextLabel: string
  quoteFrameColour: string
  quoteCustomFrameColour: string
  onChange: (patch: Partial<ItemDraft>) => void
  onNext: () => void
  onBack: () => void
}) {
  const { addons: data } = usePricing()
  const { data: pricing } = usePricing()
  const product = pricing.products.find((item) => item.key === draft.productKey)
  const category = product?.categories.find((item) => item.key === draft.categoryKey)
  const isFlyscreenWindows = draft.productKey === 'flyscreens' && draft.categoryKey === 'windows'
  const configured = !draft.serviceOnly && category && Number(draft.widthMm) > 0 && Number(draft.heightMm) > 0
    ? calcConfiguredPrice(category, Number(draft.widthMm), Number(draft.heightMm), {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
    : null

  const sections = useMemo(() => {
    const map = new Map<string, AddonItem[]>()
    for (const item of data) {
      if (draft.productKey === 'flyscreens' && item.name === 'TRIPLE LOCKS') continue
      const key = item.section ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data, draft.productKey])

  const selectedNames = new Set([...draft.addons.map((a) => a.name), ...draft.fitExtras])

  function toggle(item: AddonItem) {
    if (selectedNames.has(item.name)) {
      onChange({
        addons: draft.addons.filter((addon) => addon.name !== item.name),
        fitExtras: draft.fitExtras.filter((name) => name !== item.name),
      })
    } else {
      onChange({ addons: [...draft.addons, { name: item.name, price: item.price ?? 0 }] })
    }
  }

  function setAddonPrice(name: string, price: number) {
    const next = draft.addons.filter((item) => item.name !== name)
    onChange({
      addons: [...next, { name, price }],
      fitExtras: draft.fitExtras.filter((item) => item !== name),
    })
  }

  return (
    <div className="wizard-panel">
      <h2>Add-ons</h2>
      <p className="muted">For {contextLabel}</p>
      {draft.serviceOnly ? (
        <div className="calculator">
          <label className="field-row__single">
            Extra / repair description
            <input value={draft.serviceDescription} onChange={(e) => onChange({ serviceDescription: e.target.value })} placeholder="e.g. Re-mesh bedroom 1 flyscreen window" />
          </label>
          <label className="field-row__single">
            Work price ($)
            <input type="number" min={0} step="0.01" value={draft.servicePrice} onChange={(e) => onChange({ servicePrice: e.target.value })} placeholder="0.00" />
          </label>
        </div>
      ) : (
        <div className="calculator">
          {category?.extras && category.extras.options.length > 0 && (
            <label className="field-row__single">
              Mesh type
              <select value={draft.meshOption} onChange={(e) => onChange({ meshOption: e.target.value })}>
                <option value={STANDARD_MESH}>Standard (included)</option>
                {category.extras.options.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
              </select>
            </label>
          )}
          {isFlyscreenWindows && (
            <label className="checkbox-row">
              <input type="checkbox" checked={draft.doubleHung} onChange={(e) => onChange({ doubleHung: e.target.checked })} />
              Double hung window (+{formatCurrency(DOUBLE_HUNG_SURCHARGE)})
            </label>
          )}
          <fieldset className="field-row__single">
            <legend>Frame colour</legend>
            <label className="checkbox-row"><input type="radio" name="frameColourMode" checked={draft.frameColourMode === 'default'} onChange={() => onChange({ frameColourMode: 'default' })} />Use quote default ({displayFrameColour(quoteFrameColour, quoteCustomFrameColour)})</label>
            <label className="checkbox-row"><input type="radio" name="frameColourMode" checked={draft.frameColourMode === 'custom'} onChange={() => onChange({ frameColourMode: 'custom', customFrameColour: draft.customFrameColour || colours[0]?.name || '' })} />Custom colour for this item</label>
            {draft.frameColourMode === 'custom' && <select value={draft.customFrameColour} onChange={(e) => onChange({ customFrameColour: e.target.value })}>{colours.map((colour) => <option key={colour.name} value={colour.name}>{colour.name}</option>)}</select>}
          </fieldset>
          {configured?.unitPrice != null && <p className="muted small">Product price including mesh: {formatCurrency(configured.unitPrice)}</p>}
        </div>
      )}

      <p className="muted small">Select any priced add-on, then edit its price for this quote if needed.</p>

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
                const isSelected = selectedNames.has(item.name)
                const selectedPrice = draft.addons.find((addon) => addon.name === item.name)?.price ?? item.price ?? 0
                return (
                  <tr key={item.name}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(item)}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>
                      {isSelected ? (
                        <input type="number" min={0} step="0.01" className="price-input" aria-label={`${item.name} price`} value={selectedPrice} onChange={(e) => setAddonPrice(item.name, Number(e.target.value))} />
                      ) : item.priceOnRequest ? 'Price on request' : formatCurrency(item.price ?? 0)}
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
        <button type="button" className="primary-button" onClick={onNext} disabled={draft.serviceOnly ? !draft.serviceDescription.trim() || !Number.isFinite(Number(draft.servicePrice)) || Number(draft.servicePrice) < 0 : !configured?.lookup.ok}>
          Continue
        </button>
      </div>
    </div>
  )
}
