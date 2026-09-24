import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { calcConfiguredPrice } from '../../lib/configuredPrice'
import { LINE_FIT_EXTRAS } from '../../lib/lineExtras'
import { describeStructuredItem, openingLabel } from '../../lib/lineDescription'
import { usePricing } from '../../lib/pricingContext'
import { useQuote, type QuoteLineItem } from '../../lib/quoteContext'
import type { DrawStroke, MarkerPosition } from '../../lib/sheetDraw'
import { configFamily } from '../../lib/quoteSheet'
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
import {
  clearWizardDraft,
  FROM_WIZARD_NAV_STATE,
  loadWizardDraft,
  saveWizardDraft,
  WIZARD_DRAFT_PERSIST_MS,
  type WizardDraftKey,
} from './wizardDraftStore'
import { STEP_LABELS, STEP_ORDER, type Step } from './wizardSteps'

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

  const quoteNo = id ?? ''
  const sessionKind: WizardDraftKey['kind'] = itemId
    ? 'edit'
    : basedOnId && mode === 'duplicate'
      ? 'duplicate'
      : basedOnId && mode === 'reuse'
        ? 'reuse'
        : 'new'
  const sessionRefId = itemId ?? basedOnId ?? null
  const draftKey: WizardDraftKey = { quoteNo, kind: sessionKind, refId: sessionRefId }

  // A persisted in-progress wizard session (from a previous mount of this exact same
  // wizard route) takes priority over the source item -- otherwise navigating away and
  // back would silently discard unsaved edits and re-seed from the last saved values.
  const [initialSnapshot] = useState(() => loadWizardDraft(draftKey))

  const [draft, setDraft] = useState<ItemDraft>(() => {
    if (initialSnapshot) return initialSnapshot.draft
    if (itemId) return sourceItem ? draftFromItem(sourceItem, data.products) : emptyItemDraft()
    if (basedOnId && mode === 'reuse') return sourceItem ? draftForReuse(sourceItem, data.products) : emptyItemDraft()
    if (basedOnId && mode === 'duplicate') return sourceItem ? draftFromItem(sourceItem, data.products) : emptyItemDraft()
    return emptyItemDraft()
  })

  const isEditOrDuplicate = Boolean(itemId) || (Boolean(basedOnId) && mode === 'duplicate')
  const initialStep: Step = initialSnapshot?.step ?? (isEditOrDuplicate ? 'review' : 'location')
  const [step, setStep] = useState<Step>(initialStep)
  // Edit/Duplicate open with saved values already populated, so every tab must be reachable
  // immediately -- otherwise a blank categoryKey (or any other field) can strand the user on
  // Review with no way back to Product to fix it.
  const [visited, setVisited] = useState<Set<Step>>(() =>
    initialSnapshot
      ? new Set(initialSnapshot.visited)
      : isEditOrDuplicate
        ? new Set(STEP_ORDER)
        : new Set([initialStep]),
  )
  const [error, setError] = useState<string | null>(null)

  const [markers, setMarkers] = useState<Record<string, MarkerPosition>>(() => initialSnapshot?.markers ?? {})
  const [strokes, setStrokes] = useState<DrawStroke[]>(() => initialSnapshot?.strokes ?? [])
  const prevConfigRef = useRef(draft.configurationCode)

  useEffect(() => {
    if (prevConfigRef.current !== draft.configurationCode) {
      setMarkers({})
      setStrokes([])
      prevConfigRef.current = draft.configurationCode
    }
  }, [draft.configurationCode])

  // finishedRef suppresses the debounced/unmount persistence below once the draft has been
  // explicitly saved, discarded, or found stale -- otherwise those effects would silently
  // re-write (resurrect) the very draft that was just cleared.
  const finishedRef = useRef(false)

  const notFound = (itemId && !sourceItem) || (basedOnId && !sourceItem)
  useEffect(() => {
    if (notFound) {
      finishedRef.current = true
      clearWizardDraft(draftKey)
    }
    // Only run once on mount for this session -- notFound/draftKey are stable for the life of the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const latestSnapshotRef = useRef({ step, visited, draft, markers, strokes })
  latestSnapshotRef.current = { step, visited, draft, markers, strokes }

  useEffect(() => {
    if (finishedRef.current) return
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return
      saveWizardDraft(draftKey, { step, visited: [...visited], draft, markers, strokes, updatedAt: Date.now() })
    }, WIZARD_DRAFT_PERSIST_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteNo, sessionKind, sessionRefId, step, visited, draft, markers, strokes])

  useEffect(() => {
    return () => {
      if (finishedRef.current) return
      const snap = latestSnapshotRef.current
      saveWizardDraft(draftKey, {
        step: snap.step,
        visited: [...snap.visited],
        draft: snap.draft,
        markers: snap.markers,
        strokes: snap.strokes,
        updatedAt: Date.now(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteNo, sessionKind, sessionRefId])

  if (notFound) {
    return (
      <div>
        <p className="price-result--error">That item could not be found on this quote.</p>
        <Link to={`/quotes/${id}`} state={FROM_WIZARD_NAV_STATE}>
          &larr; Back to quote
        </Link>
      </div>
    )
  }

  if (locked) {
    return (
      <div className="wizard-shell">
        <p>
          <Link to={`/quotes/${id}`} state={FROM_WIZARD_NAV_STATE}>
            &larr; Back to quote
          </Link>
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
    if (draft.lockHeightMm && !(Number(draft.lockHeightMm) > 0)) {
      setError('Enter a valid lock height in millimetres.')
      return
    }
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
    const calculatedPrice = configured.unitPrice + fitExtraTotal + addonsTotal

    let finalPrice = calculatedPrice
    let priceOverridden = false
    if (itemId && sourceItem?.priceOverridden) {
      const priceChanged = sourceItem.calculatedPrice != null && sourceItem.calculatedPrice !== calculatedPrice
      const previousFinal = sourceItem.finalPrice ?? sourceItem.unitPrice
      if (!priceChanged) {
        finalPrice = previousFinal
        priceOverridden = true
      } else {
        const keepOverride = window.confirm(
          `This item's price was manually set to ${previousFinal.toFixed(2)}. The recalculated price ` +
            `is now ${calculatedPrice.toFixed(2)} -- click OK to keep your manual price, or Cancel to use the new calculated price.`,
        )
        if (keepOverride) {
          finalPrice = previousFinal
          priceOverridden = true
        }
      }
    }

    const productLabel = `${product.name} ${openingLabel(category.key, category.label)}`
    const description = describeStructuredItem({ location: draft.location, productLabel, widthMm, heightMm })

    const payload: Omit<QuoteLineItem, 'id'> = {
      description,
      detail: `${widthMm} x ${heightMm} mm`,
      quantity: draft.quantity,
      unitPrice: finalPrice,
      calculatedPrice,
      finalPrice,
      priceOverridden,
      room: draft.location,
      note: draft.note.trim(),
      productKey: draft.productKey,
      categoryKey: draft.categoryKey,
      location: draft.location,
      configurationCode: draft.configurationCode,
      measurements: draft.measurements,
      lockHeightMm: draft.lockHeightMm ? Number(draft.lockHeightMm) : null,
      lockSide: draft.lockSide,
      centreTongue: draft.centreTongue,
      bowed: draft.bowed,
      openingWidthMm: widthMm,
      openingHeightMm: heightMm,
      material: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
      fitExtras: draft.fitExtras,
      frameColourMode: draft.frameColourMode,
      customFrameColour: draft.customFrameColour,
      addons: draft.addons,
      photos: draft.photos,
    }

    if (itemId) {
      updateItem(itemId, payload)
      finishedRef.current = true
      clearWizardDraft(draftKey)
      navigate(`/quotes/${id}`, { state: FROM_WIZARD_NAV_STATE })
      return
    }

    const match = findMatchingItem(items, payload)
    if (match) {
      setQuantity(match.id, match.quantity + draft.quantity)
      finishedRef.current = true
      clearWizardDraft(draftKey)
      navigate(`/quotes/${id}`, { state: FROM_WIZARD_NAV_STATE })
      return
    }

    const ok = addItem(payload)
    if (!ok) {
      setError('This quote is locked and cannot accept new items.')
      return
    }
    finishedRef.current = true
    clearWizardDraft(draftKey)
    navigate(`/quotes/${id}`, { state: FROM_WIZARD_NAV_STATE })
  }

  function handleDiscard() {
    if (!window.confirm('Discard this unsaved opening? Any changes on this item will be lost.')) return
    finishedRef.current = true
    clearWizardDraft(draftKey)
    navigate(`/quotes/${id}`, { state: FROM_WIZARD_NAV_STATE })
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
        <Link to={`/quotes/${id}`} state={FROM_WIZARD_NAV_STATE}>
          &larr; Back to quote
        </Link>
        {' · '}
        <button type="button" className="link-button" onClick={handleDiscard}>
          Discard this opening
        </button>
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
            patchDraft(code === draft.configurationCode ? {} : {
              configurationCode: code,
              measurements: {},
              lockHeightMm: '',
              lockSide: configFamily(code) === 'hinged' ? (code.endsWith('-L') ? 'left' : code.endsWith('-R') ? 'right' : '') : '',
              centreTongue: false,
              bowed: false,
            })
            goToStep('measurements')
          }}
          onBack={() => goToStep('location')}
        />
      )}

      {step === 'measurements' && (
        <MeasurementStep
          code={draft.configurationCode}
          values={draft.measurements}
          lockHeightMm={draft.lockHeightMm}
          lockSide={draft.lockSide}
          centreTongue={draft.centreTongue}
          bowed={draft.bowed}
          onHardwareChange={patchDraft}
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
