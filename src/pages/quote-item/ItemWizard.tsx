import { customerQuoteNote } from '../../lib/quotePrint'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { calcConfiguredPrice } from '../../lib/configuredPrice'
import { LINE_FIT_EXTRAS } from '../../lib/lineExtras'
import { describeStructuredItem, formatItemDimensions, openingLabel } from '../../lib/lineDescription'
import { usePricing } from '../../lib/pricingContext'
import { useQuote, type QuoteLineItem } from '../../lib/quoteContext'
import type { DrawStroke, MarkerPosition } from '../../lib/sheetDraw'
import { calcSheetSize, configFamily, findSheetConfig } from '../../lib/quoteSheet'
import AddonStep from './AddonStep'
import ConfigurationPicker from './ConfigurationPicker'
import {
  compatibleCategories,
  draftForReuse,
  draftFromItem,
  emptyItemDraft,
  findMatchingItem,
  type ItemDraft,
} from './itemDraft'
import MeasurementStep from './MeasurementStep'
import OpeningLocationStep from './OpeningLocationStep'
import ProductSelectionStep from './ProductSelectionStep'
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
  const serviceRoute = !itemId && !basedOnId && searchParams.get('service') === '1'

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
        : serviceRoute ? 'service' : 'new'
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
    return serviceRoute ? { ...emptyItemDraft(), serviceOnly: true } : emptyItemDraft()
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

  function handleSave() {
    if (locked) {
      setError('This quote is locked and cannot accept item changes.')
      return
    }
    const product = data.products.find((p) => p.key === draft.productKey)
    const category = product?.categories.find((c) => c.key === draft.categoryKey)
    const widthMm = Number(draft.widthMm)
    const heightMm = Number(draft.heightMm)
    const config = findSheetConfig(draft.configurationCode)
    const pricingSize = config ? calcSheetSize(config, heightMm, widthMm) : null
    if (!draft.location.trim()) {
      setError('Choose a location before saving.')
      return
    }
    if (draft.serviceOnly && !draft.serviceDescription.trim()) {
      setError('Describe the extra or repair before saving.')
      return
    }
    if (draft.serviceOnly && (!Number.isFinite(Number(draft.servicePrice)) || Number(draft.servicePrice) < 0)) {
      setError('Enter a valid service price.')
      return
    }
    if (!draft.serviceOnly && !draft.centreTongue && draft.lockHeightMm && !(Number(draft.lockHeightMm) > 0)) {
      setError('Enter a valid lock height in millimetres.')
      return
    }
    if (!draft.serviceOnly && draft.centreTongue && [draft.lockTopMm, draft.lockCentreMm, draft.lockBottomMm].some((value) => !(Number(value) > 0))) {
      setError('Enter the top, centre and bottom lock positions in millimetres.')
      return
    }
    if (!draft.serviceOnly && draft.midRailRequired && !(Number(draft.midRailHeightMm) > 0)) {
      setError('Enter the mid-rail height in millimetres.')
      return
    }
    if (!draft.serviceOnly && (!product || !category || !pricingSize)) {
      setError('Choose a product and enter a valid size before saving.')
      return
    }
    if (!draft.serviceOnly && product && category && !compatibleCategories(product, draft.configurationCode).some((candidate) => candidate.key === category.key)) {
      setError('The selected product category does not match this opening configuration.')
      return
    }

    const isFlyscreenWindows = product?.key === 'flyscreens' && category?.key === 'windows'
    const pricingWidth = pricingSize
      ? pricingSize.screenWidth + (draft.interlockAdjustment === 'add' ? 5 : draft.interlockAdjustment === 'remove' ? -5 : 0)
      : 0
    const configured = !draft.serviceOnly && category && pricingSize && pricingWidth > 0
      ? calcConfiguredPrice(category, pricingWidth, pricingSize.screenHeight, {
      meshOption: draft.meshOption,
      doubleHung: isFlyscreenWindows && draft.doubleHung,
    }) : null
    if (!draft.serviceOnly && (!configured?.lookup.ok || configured.unitPrice == null)) {
      setError('This size is not available for the selected product and category.')
      return
    }

    const fitExtraTotal = LINE_FIT_EXTRAS.filter((extra) => draft.fitExtras.includes(extra.addonName)).reduce(
      (sum, extra) => sum + (addons.find((a) => a.name === extra.addonName)?.price ?? 0),
      0,
    )
    const addonsTotal = draft.addons.reduce((sum, a) => sum + a.price, 0)
    const calculatedPrice = (draft.serviceOnly ? Number(draft.servicePrice || 0) : configured?.unitPrice ?? 0) + fitExtraTotal + addonsTotal

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

    const productLabel = product && category ? `${product.name} ${openingLabel(category.key, category.label)}` : ''
    const description = draft.serviceOnly
      ? `${draft.location} — ${draft.serviceDescription.trim()}`
      : describeStructuredItem({ location: draft.location, productLabel, widthMm, heightMm })

    const payload: Omit<QuoteLineItem, 'id'> = {
      description,
      detail: draft.serviceOnly ? '' : formatItemDimensions(heightMm, widthMm),
      quantity: draft.quantity,
      unitPrice: finalPrice,
      calculatedPrice,
      finalPrice,
      priceOverridden,
      room: draft.location,
      note: draft.note.trim(),
      customerNote: customerQuoteNote(draft).trim(),
      productKey: draft.productKey,
      categoryKey: draft.categoryKey,
      location: draft.location,
      configurationCode: draft.configurationCode,
      measurements: draft.measurements,
      lockHeightMm: draft.lockHeightMm ? Number(draft.lockHeightMm) : null,
      lockSide: draft.lockSide,
      centreTongue: draft.centreTongue,
      lockTopMm: draft.centreTongue ? Number(draft.lockTopMm) : null,
      lockCentreMm: draft.centreTongue ? Number(draft.lockCentreMm) : null,
      lockBottomMm: draft.centreTongue ? Number(draft.lockBottomMm) : null,
      midRailRequired: draft.midRailRequired,
      midRailHeightMm: draft.midRailRequired ? Number(draft.midRailHeightMm) : null,
      interlockAdjustment: draft.interlockAdjustment,
      bowed: draft.bowed,
      serviceOnly: draft.serviceOnly,
      serviceDescription: draft.serviceDescription.trim(),
      servicePrice: draft.serviceOnly ? Number(draft.servicePrice || 0) : 0,
      openingWidthMm: draft.serviceOnly ? undefined : widthMm,
      openingHeightMm: draft.serviceOnly ? undefined : heightMm,
      material: draft.meshOption,
      doubleHung: Boolean(isFlyscreenWindows && draft.doubleHung),
      fitExtras: draft.fitExtras,
      fitExtraPrices: draft.fitExtras.map((name) => ({ name, price: addons.find((addon) => addon.name === name)?.price ?? 0 })),
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
    draft.widthMm && draft.heightMm
      ? formatItemDimensions(Number(draft.heightMm), Number(draft.widthMm))
      : undefined,
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
          <h1>{itemId ? 'Edit opening' : serviceRoute ? 'Add extra / repair' : 'Add opening'}</h1>
          {contextLabel ? <p className="muted small">{contextLabel}</p> : null}
        </div>
      </header>

      <div className="tabs wizard-steps">
        {STEP_ORDER.filter((s) => !draft.serviceOnly || (s !== 'configuration' && s !== 'product' && s !== 'measurements')).map((s) => (
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
          originalLocation={mode === 'reuse' ? (sourceItem?.location ?? sourceItem?.room) : undefined}
          onNext={(location) => {
            patchDraft({ location })
            goToStep(draft.serviceOnly ? 'addons' : 'configuration')
          }}
        />
      )}

      {step === 'product' && (
        <ProductSelectionStep
          draft={draft}
          onChange={patchDraft}
          onNext={() => goToStep('measurements')}
          onBack={() => goToStep('configuration')}
        />
      )}

      {step === 'configuration' && (
        <ConfigurationPicker
          value={draft.configurationCode}
          productKey={draft.productKey}
          onNext={(code) => {
            const product = data.products.find((candidate) => candidate.key === draft.productKey)
            const category = product ? compatibleCategories(product, code)[0] : undefined
            patchDraft(code === draft.configurationCode ? { categoryKey: category?.key ?? '' } : {
              configurationCode: code,
              categoryKey: category?.key ?? '',
              measurements: {},
              widthMm: '',
              heightMm: '',
              lockHeightMm: '',
              lockTopMm: '',
              lockCentreMm: '',
              lockBottomMm: '',
              lockSide: configFamily(code) === 'hinged' ? (code.endsWith('-L') ? 'left' : code.endsWith('-R') ? 'right' : '') : '',
              centreTongue: false,
              midRailRequired: false,
              midRailHeightMm: '',
              interlockAdjustment: '',
              bowed: false,
            })
            goToStep('product')
          }}
          onBack={() => goToStep('location')}
        />
      )}

      {step === 'measurements' && (
        <MeasurementStep
          code={draft.configurationCode}
          productKey={draft.productKey}
          values={draft.measurements}
          lockHeightMm={draft.lockHeightMm}
          lockSide={draft.lockSide}
          centreTongue={draft.centreTongue}
          lockTopMm={draft.lockTopMm}
          lockCentreMm={draft.lockCentreMm}
          lockBottomMm={draft.lockBottomMm}
          midRailRequired={draft.midRailRequired}
          midRailHeightMm={draft.midRailHeightMm}
          interlockAdjustment={draft.interlockAdjustment}
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
            patchDraft(patch)
            goToStep('addons')
          }}
          onBack={() => goToStep('product')}
        />
      )}

      {step === 'addons' && (
        <AddonStep
          draft={draft}
          contextLabel={contextLabel}
          quoteFrameColour={frameColour}
          quoteCustomFrameColour={customFrameColour}
          onChange={patchDraft}
          onNext={() => goToStep('review')}
          onBack={() => goToStep(draft.serviceOnly ? 'location' : 'measurements')}
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
