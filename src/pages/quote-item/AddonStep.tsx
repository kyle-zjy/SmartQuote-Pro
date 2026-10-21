import { useMemo } from 'react'
import colours from '../../data/colours.json'
import type { AddonItem } from '../../types/pricing'
import { calcConfiguredGroupPrice, DOUBLE_HUNG_SURCHARGE, STANDARD_MESH } from '../../lib/configuredPrice'
import { displayFrameColour } from '../../lib/frameColour'
import { formatCurrency } from '../../lib/formatCurrency'
import { usePricing } from '../../lib/pricingContext'
import { adjustedPricingGroups, findSheetConfig, sheetSizeFromMeasures } from '../../lib/quoteSheet'
import type { ItemDraft } from './itemDraft'
import { addonAvailable, draftChargesError, draftFittingCharges } from './itemCharges'

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
  const { serviceOnly, productKey } = draft
  const product = pricing.products.find((item) => item.key === draft.productKey)
  const category = product?.categories.find((item) => item.key === draft.categoryKey)
  const isFlyscreenWindows = draft.productKey === 'flyscreens' && draft.categoryKey === 'windows'
  const config = findSheetConfig(draft.configurationCode)
  const pricingSize = config ? sheetSizeFromMeasures(config, draft.measurements) : null
  const pricingGroups = pricingSize ? adjustedPricingGroups(pricingSize, draft.interlockAdjustment) : []
  const configured = !draft.serviceOnly && category && pricingGroups.length > 0
    ? calcConfiguredGroupPrice(category, pricingGroups, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
    : null

  const sections = useMemo(() => {
    const map = new Map<string, AddonItem[]>()
    for (const item of data) {
      if (!addonAvailable(item, { serviceOnly, productKey })) continue
      const key = item.section ?? 'Other'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data, productKey, serviceOnly])

  const selectedNames = new Set([...draft.addons.map((a) => a.name), ...draft.fitExtras])
  const fittingCharges = draftFittingCharges(draft, data)
  const availableNames = new Set([...sections.values()].flat().map((item) => item.name))
  const previousCharges = [...draft.addons, ...fittingCharges].filter((item) => !availableNames.has(item.name))
  const chargesError = draftChargesError(draft, data)

  function removeCharge(name: string) {
    onChange({
      addons: draft.addons.filter((addon) => addon.name !== name),
      fitExtras: draft.fitExtras.filter((extra) => extra !== name),
      unpricedAddons: draft.unpricedAddons?.filter((extra) => extra !== name),
    })
  }

  function toggle(item: AddonItem) {
    if (selectedNames.has(item.name)) {
      removeCharge(item.name)
    } else {
      onChange({
        addons: [...draft.addons, { name: item.name, price: item.price ?? 0 }],
        unpricedAddons: item.priceOnRequest && item.price === null ? [...(draft.unpricedAddons ?? []), item.name] : draft.unpricedAddons,
      })
    }
  }

  function setAddonPrice(name: string, input: string) {
    const next = draft.addons.filter((item) => item.name !== name)
    onChange({
      addons: [...next, { name, price: Number(input) }],
      fitExtras: draft.fitExtras.filter((item) => item !== name),
      unpricedAddons: input.trim() ? (draft.unpricedAddons ?? []).filter((item) => item !== name) : [...new Set([...(draft.unpricedAddons ?? []), name])],
    })
  }

  return (
    <div className="wizard-panel">
      <h2>{draft.serviceOnly ? 'Extras' : 'Add-ons'}</h2>
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
          {configured?.unitPrice != null && <p className="muted small">Product price including all panels and mesh: {formatCurrency(configured.unitPrice)}</p>}
        </div>
      )}

      <p className="muted small">Select any priced {draft.serviceOnly ? 'extra' : 'add-on'}, then edit its price for this quote if needed.</p>

      {previousCharges.length > 0 && (
        <section className="addon-section" aria-label="Previously selected charges">
          <h3>Previously selected charges</h3>
          <p className="muted small">These charges were saved earlier and are unavailable for this item type or current price list. They still affect the total. Remove any that no longer apply.</p>
          <ul>
            {previousCharges.map((charge) => <li key={charge.name}>{charge.name} — {formatCurrency(charge.price)}{' '}
              <button type="button" className="link-button" onClick={() => removeCharge(charge.name)}>Remove {charge.name}</button>
            </li>)}
          </ul>
        </section>
      )}

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
                const selectedPrice = draft.addons.find((addon) => addon.name === item.name)?.price ?? fittingCharges.find((extra) => extra.name === item.name)?.price ?? item.price ?? 0
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
                        <input type="number" min={0} step="0.01" className="price-input" aria-label={`${item.name} price`} value={draft.unpricedAddons?.includes(item.name) ? '' : selectedPrice} onChange={(e) => setAddonPrice(item.name, e.target.value)} />
                      ) : item.priceOnRequest ? 'Price on request' : formatCurrency(item.price ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {chargesError && <p role="alert" className="price-result--error">{chargesError}</p>}

      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
        <button type="button" className="primary-button" onClick={onNext} disabled={Boolean(chargesError) || (draft.serviceOnly ? !draft.serviceDescription.trim() || !draft.servicePrice.trim() || !Number.isFinite(Number(draft.servicePrice)) || Number(draft.servicePrice) < 0 : !configured?.ok)}>
          Continue
        </button>
      </div>
    </div>
  )
}
