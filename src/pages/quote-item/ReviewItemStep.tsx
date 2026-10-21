import { useState } from 'react'
import ItemPhotos from '../../components/ItemPhotos'
import { customerQuoteNote } from '../../lib/quotePrint'
import ProductQuoteNotes from '../../components/ProductQuoteNotes'
import { calcConfiguredGroupPrice, STANDARD_MESH } from '../../lib/configuredPrice'
import { effectiveFrameColour } from '../../lib/frameColour'
import { formatCurrency } from '../../lib/formatCurrency'
import { fitExtraPhrase } from '../../lib/lineExtras'
import { describeStructuredItem, formatItemDimensions, productQuoteLabel } from '../../lib/lineDescription'
import { usePricing } from '../../lib/pricingContext'
import { adjustedPricingGroups, configLabel, findSheetConfig, sheetSizeFromMeasures } from '../../lib/quoteSheet'
import { calcAddonsTotal, type ItemDraft } from './itemDraft'
import { draftFittingCharges } from './itemCharges'

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
  const config = findSheetConfig(draft.configurationCode)
  const pricingSize = config ? sheetSizeFromMeasures(config, draft.measurements) : null
  const pricingGroups = pricingSize ? adjustedPricingGroups(pricingSize, draft.interlockAdjustment) : []

  const configured = category && pricingGroups.length > 0
    ? calcConfiguredGroupPrice(category, pricingGroups, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
    : null

  const fitExtraItems = draftFittingCharges(draft, addons)
  const fitExtraTotal = fitExtraItems.reduce((sum, extra) => sum + extra.price, 0)
  const addonsTotal = calcAddonsTotal(draft.addons)
  const unitPrice = draft.serviceOnly
    ? Number(draft.servicePrice || 0) + fitExtraTotal + addonsTotal
    : configured?.unitPrice != null ? configured.unitPrice + fitExtraTotal + addonsTotal : null
  const lineTotal = unitPrice != null ? unitPrice * draft.quantity : null

  const colourName = effectiveFrameColour(draft, quoteFrameColour, quoteCustomFrameColour)
  const productLabel =
    product && category ? productQuoteLabel({ productKey: product.key, productName: product.name, categoryKey: category.key, categoryLabel: category.label, configurationCode: draft.configurationCode, meshOption: draft.meshOption }) : ''
  const description = draft.serviceOnly ? `${draft.location} — ${draft.serviceDescription.trim()}` : describeStructuredItem({
    location: draft.location,
    productLabel,
    widthMm,
    heightMm,
  })

  return (
    <div className="wizard-panel">
      <h2>Review &amp; save</h2>

      <dl className="review-recap">
        <dt>Location</dt>
        <dd>{draft.location || '—'}</dd>
        <dt>Configuration</dt>
        <dd>
          {draft.serviceOnly ? 'N/A' : draft.configurationCode ? `${draft.configurationCode} · ${configLabel(draft.configurationCode)}` : '—'}
        </dd>
        <dt>Product</dt>
        <dd>{draft.serviceOnly ? 'Extra / repair only' : product ? `${product.name} (${category?.label ?? ''})` : '—'}</dd>
        <dt>Size</dt>
        <dd>{draft.serviceOnly ? 'N/A' : widthMm > 0 && heightMm > 0 ? formatItemDimensions(heightMm, widthMm) : '—'}</dd>
        {!draft.serviceOnly && draft.configurationCode !== 'WS' && (
          <>
            <dt>Lock height</dt>
            <dd>{draft.centreTongue ? 'N/A' : draft.lockHeightMm ? `${draft.lockHeightMm} mm` : 'Not recorded'}</dd>
            <dt>Lock side</dt>
            <dd>{draft.lockSide || 'Not recorded'}</dd>
            <dt>Centre tongue</dt>
            <dd>{draft.centreTongue ? 'Yes' : 'No'}</dd>
            {draft.centreTongue && (
              <>
                <dt>Lock positions</dt>
                <dd>Top {draft.lockTopMm || '—'} · Centre {draft.lockCentreMm || '—'} · Bottom {draft.lockBottomMm || '—'} mm</dd>
              </>
            )}
            <dt>Mid-rail</dt>
            <dd>{draft.midRailRequired ? `${draft.midRailHeightMm || '—'} mm` : 'No'}</dd>
            {draft.interlockAdjustment && <><dt>Door interlock</dt><dd>{draft.interlockAdjustment === 'add' ? '5 mm added' : draft.interlockAdjustment === 'remove' ? '5 mm removed' : '0 mm removed'}</dd></>}
            <dt>Door bowed</dt>
            <dd>{draft.bowed ? 'Yes' : 'No'}</dd>
          </>
        )}
        <dt>Mesh</dt>
        <dd>{draft.serviceOnly ? 'N/A' : draft.meshOption !== STANDARD_MESH ? draft.meshOption : 'Standard'}</dd>
        <dt>Frame colour</dt>
        <dd>{colourName}</dd>
        <dt>Fitting extras</dt>
        <dd>{fitExtraItems.length > 0 ? fitExtraItems.map((e) => `${fitExtraPhrase(e.name)} (${formatCurrency(e.price)})`).join(', ') : 'None'}</dd>
        <dt>{draft.serviceOnly ? 'Extras' : 'Add-ons'}</dt>
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
        Customer notes (customer only)
        <textarea value={customerQuoteNote(draft)} onChange={(e) => onChange({ customerNote: e.target.value })} rows={3} />
      </label>

      <label className="field-row__single">
        Production notes (factory only)
        <textarea value={draft.note} onChange={(e) => onChange({ note: e.target.value })} rows={3} />
      </label>

      <div className="item-photos-section">
        <h3>Photos / Markup</h3>
        <p className="muted small">Attach reference photos of this opening and mark them up if needed.</p>
        <ItemPhotos photos={draft.photos} onChange={(photos) => onChange({ photos })} disabled={locked} />
      </div>

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
        <button type="button" className="primary-button" onClick={onSave} disabled={unitPrice == null || locked || (draft.serviceOnly && !draft.serviceDescription.trim())}>
          Save Item
        </button>
      </div>
    </div>
  )
}
