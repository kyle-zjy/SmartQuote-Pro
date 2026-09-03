import { useMemo, useState } from 'react'
import ProductQuoteNotes from '../../components/ProductQuoteNotes'
import { calcConfiguredPrice, STANDARD_MESH } from '../../lib/configuredPrice'
import { effectiveFrameColour } from '../../lib/frameColour'
import { formatCurrency } from '../../lib/formatCurrency'
import { fitExtraPhrase, LINE_FIT_EXTRAS } from '../../lib/lineExtras'
import { describeStructuredItem, openingLabel } from '../../lib/lineDescription'
import { usePricing } from '../../lib/pricingContext'
import { configLabel } from '../../lib/quoteSheet'
import type { ItemDraft } from './itemDraft'

export default function ReviewItemStep({
  draft,
  quoteFrameColour,
  quoteCustomFrameColour,
  error,
  locked,
  onChange,
  onSave,
  onBack,
}: {
  draft: ItemDraft
  quoteFrameColour: string
  quoteCustomFrameColour: string
  error: string | null
  locked: boolean
  onChange: (patch: Partial<ItemDraft>) => void
  onSave: () => void
  onBack: () => void
}) {
  const { data, addons } = usePricing()
  const [notesOpen, setNotesOpen] = useState(false)
  const product = data.products.find((p) => p.key === draft.productKey)
  const category = product?.categories.find((c) => c.key === draft.categoryKey)

  const widthMm = Number(draft.widthMm)
  const heightMm = Number(draft.heightMm)
  const isFlyscreenWindows = product?.key === 'flyscreens' && category?.key === 'windows'

  const configured = useMemo(() => {
    if (!category || !(widthMm > 0) || !(heightMm > 0)) return null
    return calcConfiguredPrice(category, widthMm, heightMm, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
  }, [category, widthMm, heightMm, draft.meshOption, draft.doubleHung, isFlyscreenWindows])

  const fitExtraItems = LINE_FIT_EXTRAS.map((extra) => ({
    ...extra,
    price: addons.find((item) => item.name === extra.addonName)?.price ?? 0,
  })).filter((extra) => draft.fitExtras.includes(extra.addonName) && extra.price > 0)
  const fitExtraTotal = fitExtraItems.reduce((sum, extra) => sum + extra.price, 0)
  const addonsTotal = draft.addons.reduce((sum, addon) => sum + addon.price, 0)
  const unitPrice = configured?.unitPrice != null ? configured.unitPrice + fitExtraTotal + addonsTotal : null
  const lineTotal = unitPrice != null ? unitPrice * draft.quantity : null

  const colourName = effectiveFrameColour(draft, quoteFrameColour, quoteCustomFrameColour)
  const productLabel =
    product && category ? `${product.name} ${openingLabel(category.key, category.label)}` : ''
  const description = describeStructuredItem({
    location: draft.location,
    productLabel,
    widthMm,
    heightMm,
  })

  return (
    <div>
      <h2>Review &amp; save</h2>

      <dl className="review-recap">
        <dt>Location</dt>
        <dd>{draft.location || '—'}</dd>
        <dt>Configuration</dt>
        <dd>
          {draft.configurationCode ? `${draft.configurationCode} · ${configLabel(draft.configurationCode)}` : '—'}
        </dd>
        <dt>Product</dt>
        <dd>{product ? `${product.name} (${category?.label ?? ''})` : '—'}</dd>
        <dt>Size</dt>
        <dd>{widthMm > 0 && heightMm > 0 ? `${widthMm} × ${heightMm} mm` : '—'}</dd>
        <dt>Mesh</dt>
        <dd>{draft.meshOption !== STANDARD_MESH ? draft.meshOption : 'Standard'}</dd>
        <dt>Frame colour</dt>
        <dd>{colourName}</dd>
        <dt>Fitting extras</dt>
        <dd>{fitExtraItems.length > 0 ? fitExtraItems.map((e) => fitExtraPhrase(e.addonName)).join(', ') : 'None'}</dd>
        <dt>Add-ons</dt>
        <dd>
          {draft.addons.length > 0
            ? draft.addons.map((a) => `${a.name} (${formatCurrency(a.price)})`).join(', ')
            : 'None'}
        </dd>
      </dl>

      <p className="muted">Description preview: {description}</p>

      <div className="field-row">
        <label>
          Quantity
          <input
            type="number"
            min={1}
            value={draft.quantity}
            onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>

      <label className="field-row__single">
        Additional notes
        <textarea value={draft.note} onChange={(e) => onChange({ note: e.target.value })} rows={3} />
      </label>

      {unitPrice != null && (
        <div className="price-result">
          <p>Unit price: {formatCurrency(unitPrice)}</p>
          <p>
            Line total ({draft.quantity} × {formatCurrency(unitPrice)}): {formatCurrency(lineTotal ?? 0)}
          </p>
        </div>
      )}

      {product && (
        <div className="collapsible">
          <button type="button" className="link-button" onClick={() => setNotesOpen((v) => !v)}>
            {notesOpen ? 'Hide' : 'Show'} quote notes for {product.name}
          </button>
          {notesOpen && <ProductQuoteNotes productKey={product.key} />}
        </div>
      )}

      {error && <p className="price-result--error">{error}</p>}

      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
        <button type="button" className="primary-button" onClick={onSave} disabled={unitPrice == null || locked}>
          Save Item
        </button>
      </div>
    </div>
  )
}
