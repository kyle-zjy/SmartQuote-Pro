import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { calcConfiguredPrice } from '../../lib/configuredPrice'
import { LINE_FIT_EXTRAS } from '../../lib/lineExtras'
import { describeStructuredItem, openingLabel } from '../../lib/lineDescription'
import { usePricing } from '../../lib/pricingContext'
import { useQuote, type QuoteLineItem } from '../../lib/quoteContext'
import type { DrawStroke, MarkerPosition } from '../../lib/sheetDraw'
import AddonStep from './AddonStep'
import ConfigurationPicker from './ConfigurationPicker'
import {
  defaultProductSelection,
  draftForReuse,
  draftFromItem,
  emptyItemDraft,
  findMatchingItem,
  type ItemDraft,
} from './itemDraft'
import MeasurementStep from './MeasurementStep'
import OpeningLocationStep from './OpeningLocationStep'
import ProductStep from './ProductStep'
import ReviewItemStep from './ReviewItemStep'

type Step = 'location' | 'configuration' | 'measurements' | 'product' | 'addons' | 'review'

const STEP_LABELS: Record<Step, string> = {
  location: 'Location',
  configuration: 'Configuration',
  measurements: 'Measurements',
  product: 'Product',
  addons: 'Add-ons',
  review: 'Review',
}
const STEP_ORDER: Step[] = ['location', 'configuration', 'measurements', 'product', 'addons', 'review']

export default function ItemWizard() {
  const { id, itemId } = useParams<{ id: string; itemId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data, addons } = usePricing()
  const { items, status, dealStatus, frameColour, customFrameColour, addItem, updateItem, setQuantity } = useQuote()
  const locked = status === 'issued' || dealStatus !== 'open'

  const basedOnId = searchParams.get('basedOn')
  const mode = searchParams.get('mode')

  const sourceItem: QuoteLineItem | undefined = itemId
    ? items.find((i) => i.id === itemId)
    : basedOnId
      ? items.find((i) => i.id === basedOnId)
      : undefined

  const [draft, setDraft] = useState<ItemDraft>(() => {
    if (itemId) return sourceItem ? draftFromItem(sourceItem) : emptyItemDraft()
    if (basedOnId && mode === 'reuse') return sourceItem ? draftForReuse(sourceItem) : emptyItemDraft()
    if (basedOnId && mode === 'duplicate') return sourceItem ? draftFromItem(sourceItem) : emptyItemDraft()
    return emptyItemDraft()
  })

  const initialStep: Step = itemId || (basedOnId && mode === 'duplicate') ? 'review' : 'location'
  const [step, setStep] = useState<Step>(initialStep)
  const [visited, setVisited] = useState<Set<Step>>(() => new Set([initialStep]))
  const [error, setError] = useState<string | null>(null)

  const [markers, setMarkers] = useState<Record<string, MarkerPosition>>({})
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const prevConfigRef = useRef(draft.configurationCode)

  useEffect(() => {
    if (prevConfigRef.current !== draft.configurationCode) {
      setMarkers({})
      setStrokes([])
      prevConfigRef.current = draft.configurationCode
    }
  }, [draft.configurationCode])

  if ((itemId && !sourceItem) || (basedOnId && !sourceItem)) {
    return (
      <div>
        <p className="price-result--error">That item could not be found on this quote.</p>
        <Link to={`/quotes/${id}`}>&larr; Back to quote</Link>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="wizard-shell">
        <p>
          <Link to={`/quotes/${id}`}>&larr; Back to quote</Link>
        </p>
        <header className="page-header page-header--compact">
          <div>
            <h1>{itemId ? 'Edit opening' : 'Add opening'}</h1>
          </div>
        </header>
        <p className="quote-issued-banner quote-issued-banner--abandoned">
          {dealStatus !== 'open'
            ? 'This quote is abandoned or closed. Reopen it from Quotes, or start a new quote, before changing items.'
            : 'This quote is issued and locked. Start a new quote before changing items.'}
        </p>
      </div>
    )
  }

  function patchDraft(patch: Partial<ItemDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function goToStep(next: Step) {
    setVisited((v) => new Set(v).add(next))
    setStep(next)
  }

  const existingLocations = [...new Set(items.map((i) => (i.location ?? i.room)?.trim()).filter(Boolean))] as string[]

  function handleSave() {
    if (locked) {
      setError('This quote is locked and cannot accept item changes.')
      return
    }
    const product = data.products.find((p) => p.key === draft.productKey)
    const category = product?.categories.find((c) => c.key === draft.categoryKey)
    const widthMm = Number(draft.widthMm)
    const heightMm = Number(draft.heightMm)
    if (!product || !category || !(widthMm > 0) || !(heightMm > 0)) {
      setError('Choose a product and enter a valid size before saving.')
      return
    }

    const isFlyscreenWindows = product.key === 'flyscreens' && category.key === 'windows'
    const configured = calcConfiguredPrice(category, widthMm, heightMm, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    })
    if (!configured.lookup.ok || configured.unitPrice == null) {
      setError('This size is not available for the selected product and category.')
      return
    }

    const fitExtraTotal = LINE_FIT_EXTRAS.filter((extra) => draft.fitExtras.includes(extra.addonName)).reduce(
      (sum, extra) => sum + (addons.find((a) => a.name === extra.addonName)?.price ?? 0),
      0,
    )
    const addonsTotal = draft.addons.reduce((sum, a) => sum + a.price, 0)
    const unitPrice = configured.unitPrice + fitExtraTotal + addonsTotal

    const productLabel = `${product.name} ${openingLabel(category.key, category.label)}`
    const description = describeStructuredItem({ location: draft.location, productLabel, widthMm, heightMm })

    const payload: Omit<QuoteLineItem, 'id'> = {
      description,
      detail: `${widthMm} x ${heightMm} mm`,
      quantity: draft.quantity,
      unitPrice,
      room: draft.location,
      note: draft.note.trim(),
      productKey: draft.productKey,
      location: draft.location,
      configurationCode: draft.configurationCode,
      measurements: draft.measurements,
      openingWidthMm: widthMm,
      openingHeightMm: heightMm,
      material: draft.meshOption,
      frameColourMode: draft.frameColourMode,
      customFrameColour: draft.customFrameColour,
      addons: draft.addons,
      photos: draft.photos,
    }

    if (itemId) {
      updateItem(itemId, payload)
      navigate(`/quotes/${id}`)
      return
    }

    const match = findMatchingItem(items, payload)
    if (match) {
      setQuantity(match.id, match.quantity + draft.quantity)
      navigate(`/quotes/${id}`)
      return
    }

    const ok = addItem(payload)
    if (!ok) {
      setError('This quote is locked and cannot accept new items.')
      return
    }
    navigate(`/quotes/${id}`)
  }

  const contextLabel = [
    draft.location,
    draft.configurationCode,
    data.products.find((p) => p.key === draft.productKey)?.name,
    draft.widthMm && draft.heightMm ? `${draft.widthMm}×${draft.heightMm} mm` : undefined,
  ]
    .filter(Boolean)
    .join(' / ')

  return (
    <div className="wizard-shell">
      <p>
        <Link to={`/quotes/${id}`}>&larr; Back to quote</Link>
      </p>
      <header className="page-header page-header--compact">
        <div>
          <h1>{itemId ? 'Edit opening' : 'Add opening'}</h1>
          {contextLabel ? <p className="muted small">{contextLabel}</p> : null}
        </div>
      </header>

      <div className="tabs wizard-steps">
        {STEP_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={`tab${step === s ? ' tab--active' : ''}`}
            disabled={!visited.has(s)}
            onClick={() => goToStep(s)}
          >
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      {step === 'location' && (
        <OpeningLocationStep
          value={draft.location}
          existingLocations={existingLocations}
          originalLocation={mode === 'reuse' ? (sourceItem?.location ?? sourceItem?.room) : undefined}
          onNext={(location) => {
            patchDraft({ location })
            goToStep('configuration')
          }}
        />
      )}

      {step === 'configuration' && (
        <ConfigurationPicker
          value={draft.configurationCode}
          onNext={(code) => {
            patchDraft(code === draft.configurationCode ? {} : { configurationCode: code, measurements: {} })
            goToStep('measurements')
          }}
          onBack={() => goToStep('location')}
        />
      )}

      {step === 'measurements' && (
        <MeasurementStep
          code={draft.configurationCode}
          values={draft.measurements}
          markers={markers}
          strokes={strokes}
          onValuesChange={(measurements) => patchDraft({ measurements })}
          onMarkersChange={setMarkers}
          onStrokesChange={setStrokes}
          onNext={(size) => {
            const patch: Partial<ItemDraft> = size
              ? { widthMm: String(size.widthMm), heightMm: String(size.heightMm) }
              : {}
            if (!draft.productKey) {
              const defaults = defaultProductSelection(draft.configurationCode, data.products)
              if (defaults) Object.assign(patch, defaults)
            }
            patchDraft(patch)
            goToStep('product')
          }}
          onBack={() => goToStep('configuration')}
        />
      )}

      {step === 'product' && (
        <ProductStep
          draft={draft}
          quoteFrameColour={frameColour}
          quoteCustomFrameColour={customFrameColour}
          onChange={patchDraft}
          onNext={() => goToStep('addons')}
          onBack={() => goToStep('measurements')}
        />
      )}

      {step === 'addons' && (
        <AddonStep
          draft={draft}
          contextLabel={contextLabel}
          onChange={patchDraft}
          onNext={() => goToStep('review')}
          onBack={() => goToStep('product')}
        />
      )}

      {step === 'review' && (
        <ReviewItemStep
          draft={draft}
          quoteFrameColour={frameColour}
          quoteCustomFrameColour={customFrameColour}
          error={error}
          locked={locked}
          onChange={patchDraft}
          onSave={handleSave}
          onBack={() => goToStep('addons')}
        />
      )}
    </div>
  )
}
