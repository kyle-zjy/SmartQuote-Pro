import { useEffect, useMemo } from 'react'
import colours from '../../data/colours.json'
import PriceResultCard from '../../components/PriceResultCard'
import { calcConfiguredPrice, DOUBLE_HUNG_SURCHARGE, STANDARD_MESH } from '../../lib/configuredPrice'
import { displayFrameColour } from '../../lib/frameColour'
import { formatCurrency } from '../../lib/formatCurrency'
import { LINE_FIT_EXTRAS } from '../../lib/lineExtras'
import { usePricing } from '../../lib/pricingContext'
import { colourRecord } from '../../lib/quoteContext'
import type { ItemDraft } from './itemDraft'

export default function ProductStep({
  draft,
  quoteFrameColour,
  quoteCustomFrameColour,
  onChange,
  onNext,
  onBack,
}: {
  draft: ItemDraft
  quoteFrameColour: string
  quoteCustomFrameColour: string
  onChange: (patch: Partial<ItemDraft>) => void
  onNext: () => void
  onBack: () => void
}) {
  const { data, addons } = usePricing()
  const product = data.products.find((p) => p.key === draft.productKey) ?? data.products[0]
  const category = product?.categories.find((c) => c.key === draft.categoryKey) ?? product?.categories[0]
  const isFlyscreenWindows = product?.key === 'flyscreens' && category?.key === 'windows'

  // draft.productKey/categoryKey can be blank (new draft, or a legacy item with no stored category) --
  // the fallbacks above pick something to display, but Review/Save must see the same value, so write
  // it back as soon as it's resolved.
  useEffect(() => {
    if (product && product.key !== draft.productKey) {
      onChange({ productKey: product.key })
    } else if (category && category.key !== draft.categoryKey) {
      onChange({ categoryKey: category.key })
    }
  }, [product, category, draft.productKey, draft.categoryKey, onChange])

  const widthMm = Number(draft.widthMm)
  const heightMm = Number(draft.heightMm)
  const hasValidInput = widthMm > 0 && heightMm > 0

  const configured = useMemo(() => {
    if (!category || !hasValidInput) return null
    return calcConfiguredPrice(category, widthMm, heightMm, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
  }, [category, hasValidInput, heightMm, widthMm, draft.meshOption, draft.doubleHung, isFlyscreenWindows])

  const result = configured?.lookup ?? null
  const meshExtras = configured?.extras ?? 0
  const fitExtraItems = LINE_FIT_EXTRAS.map((extra) => ({
    ...extra,
    price: addons.find((item) => item.name === extra.addonName)?.price ?? 0,
  })).filter((extra) => extra.price > 0)
  const fitExtraTotal = fitExtraItems
    .filter((extra) => draft.fitExtras.includes(extra.addonName))
    .reduce((sum, extra) => sum + extra.price, 0)
  const totalExtras = meshExtras + fitExtraTotal
  const canContinue = hasValidInput && Boolean(result?.ok)

  const activeColourName =
    draft.frameColourMode === 'custom' && draft.customFrameColour
      ? draft.customFrameColour
      : displayFrameColour(quoteFrameColour, quoteCustomFrameColour)
  const activeColour = colourRecord(activeColourName)
  const colourMismatch = Boolean(
    product && activeColour && activeColour.products.length > 0 && !activeColour.products.includes(product.key),
  )

  if (!product) {
    return <p className="price-result--error">No products are configured. Import a price list from Admin → Pricing.</p>
  }

  function handleProductChange(key: string) {
    const nextProduct = data.products.find((p) => p.key === key)
    onChange({
      productKey: key,
      categoryKey: nextProduct?.categories[0]?.key ?? '',
      meshOption: STANDARD_MESH,
      doubleHung: false,
      fitExtras: [],
    })
  }

  function handleCategoryChange(key: string) {
    onChange({ categoryKey: key, meshOption: STANDARD_MESH, doubleHung: false, fitExtras: [] })
  }

  return (
    <div className="wizard-panel">
      <h2>Product &amp; size</h2>
      {/* TODO(compat): no product/opening-configuration compatibility data exists yet, so every
          product is offered regardless of the configuration picked earlier. Revisit if/when that
          compatibility data becomes available. */}
      <div className="tabs">
        {data.products.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`tab${p.key === product.key ? ' tab--active' : ''}`}
            onClick={() => handleProductChange(p.key)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {category && (
        <div className="calculator">
          <div className="tabs">
            {product.categories.map((c) => (
              <button
                key={c.key}
                type="button"
                className={c.key === category.key ? 'tab tab--active' : 'tab'}
                onClick={() => handleCategoryChange(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="field-row">
            <label>
              Height (mm)
              <input
                type="number"
                min={0}
                value={draft.heightMm}
                onChange={(e) => onChange({ heightMm: e.target.value })}
                placeholder={`e.g. ${category.heights[Math.floor(category.heights.length / 2)]}`}
              />
            </label>
            <label>
              Width (mm)
              <input
                type="number"
                min={0}
                value={draft.widthMm}
                onChange={(e) => onChange({ widthMm: e.target.value })}
                placeholder={`e.g. ${category.widths[Math.floor(category.widths.length / 2)]}`}
              />
            </label>
          </div>

          {category.extras && category.extras.options.length > 0 && (
            <label className="field-row__single">
              Mesh type
              <select value={draft.meshOption} onChange={(e) => onChange({ meshOption: e.target.value })}>
                <option value={STANDARD_MESH}>Standard (included)</option>
                {category.extras.options.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {fitExtraItems.length > 0 && (
            <div className="fit-extras">
              <p className="small">Add to this line</p>
              {fitExtraItems.map((extra) => (
                <label key={extra.addonName} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={draft.fitExtras.includes(extra.addonName)}
                    onChange={(e) =>
                      onChange({
                        fitExtras: e.target.checked
                          ? [...draft.fitExtras, extra.addonName]
                          : draft.fitExtras.filter((name) => name !== extra.addonName),
                      })
                    }
                  />
                  {extra.phrase} (+{formatCurrency(extra.price)})
                </label>
              ))}
            </div>
          )}

          {isFlyscreenWindows && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.doubleHung}
                onChange={(e) => onChange({ doubleHung: e.target.checked })}
              />
              Double hung window (+{formatCurrency(DOUBLE_HUNG_SURCHARGE)})
            </label>
          )}

          <fieldset className="field-row__single">
            <legend>Frame colour</legend>
            <label className="checkbox-row">
              <input
                type="radio"
                name="frameColourMode"
                checked={draft.frameColourMode === 'default'}
                onChange={() => onChange({ frameColourMode: 'default' })}
              />
              Use quote default ({displayFrameColour(quoteFrameColour, quoteCustomFrameColour)})
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="frameColourMode"
                checked={draft.frameColourMode === 'custom'}
                onChange={() =>
                  onChange({ frameColourMode: 'custom', customFrameColour: draft.customFrameColour || colours[0]?.name || '' })
                }
              />
              Custom colour for this item
            </label>
            {draft.frameColourMode === 'custom' && (
              <select value={draft.customFrameColour} onChange={(e) => onChange({ customFrameColour: e.target.value })}>
                {colours.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </fieldset>
          {colourMismatch && (
            <p className="muted small">
              {activeColourName} is not listed as available for {product.name}. Confirm against the colour chart
              before sending.
            </p>
          )}

          {hasValidInput && result && (
            <PriceResultCard result={result} extraSurcharge={totalExtras} formatCurrency={formatCurrency} />
          )}
        </div>
      )}

      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
        <button type="button" className="primary-button" onClick={onNext} disabled={!canContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}
