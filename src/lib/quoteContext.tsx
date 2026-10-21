import { workspaceStorage } from './workspaceStorage'
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import colours from '../data/colours.json'
import {
  ARCHIVE_KEY,
  addArchivedQuoteComment,
  deleteArchivedQuote,
  getArchivedQuote,
  listArchivedQuotes,
  setArchivedQuoteDealStatus,
  upsertArchivedQuote,
  type ArchiveWriteResult,
  type ArchivedQuote,
} from './quoteArchive'
import { useCompanySettings } from './companySettings'
import { OTHER_FRAME_COLOUR } from './frameColour'
import { formatItemDimensions, padMm } from './lineDescription'
import { loadRoomPhotos, restoreRoomPhotoData, saveRoomPhotos } from './quotePhotoStore'
import { findSheetConfig, openingFromMeasures, sheetSizeFromMeasures } from './quoteSheet'
import { DRAFT_PERSIST_MS, MEASURE_LEGACY_DRAFT_PERSIST, persistDraftQuote, readTabDraft, quoteDraftKey, stripRoomPhotoData } from './quotePersist'
import {
  canIssueQuote,
  canReviseQuote,
  canSubmitForReview,
  createIssuedSnapshot,
  isActionLocked,
  parseDealStatus,
  quoteFinancials,
  type DealStatus,
  type IssuedSnapshot,
  type QuoteStatus,
} from './quoteLifecycle'
import type { DrawStroke } from './sheetDraw'
import { useAuth } from './authContext'
import { canIssueReviewedQuote, submitQuoteForReview } from './quoteReview'
import { withStorageRollback } from './storageTransaction'
import { useQuoteEditLock, withQuoteStorageLock, withQuoteWriteAccess } from './quoteWriteLock'
import { SERVER_MODE, SERVER_DATA_EVENT, readToken } from './apiClient'
import { allocateQuoteNumber, pinQuote, reloadPinnedQuote, refreshWorkspace, saveRemoteDraft, reportSyncError } from './serverWorkspace'

export interface QuoteAddon {
  name: string
  price: number
}

export interface ItemPhoto {
  id: string
  /** Original uploaded image (resized), never mutated by annotation. */
  dataUrl: string
  /** Annotation strokes drawn on top of dataUrl. */
  strokes: DrawStroke[]
  /** Flattened image+strokes composite; null until the photo has been annotated and saved. */
  annotatedDataUrl: string | null
}

export interface QuoteLineItem {
  id: string
  description: string
  detail: string
  quantity: number
  unitPrice: number
  room: string
  note: string
  customerNote?: string
  productKey?: string
  // Structured fields for items built through the opening/item wizard.
  // All optional so legacy flat items (description/detail/room only) keep working unchanged.
  location?: string
  configurationCode?: string
  measurements?: Record<string, string>
  lockHeightMm?: number | null
  lockSide?: 'left' | 'right' | ''
  centreTongue?: boolean
  lockTopMm?: number | null
  lockCentreMm?: number | null
  lockBottomMm?: number | null
  midRailRequired?: boolean
  midRailHeightMm?: number | null
  interlockAdjustment?: 'add' | 'remove' | 'remove-zero' | ''
  bowed?: boolean
  serviceOnly?: boolean
  serviceDescription?: string
  servicePrice?: number
  openingWidthMm?: number
  openingHeightMm?: number
  material?: string
  frameColourMode?: 'default' | 'custom'
  customFrameColour?: string
  addons?: QuoteAddon[]
  photos?: ItemPhoto[]
  categoryKey?: string
  doubleHung?: boolean
  fitExtras?: string[]
  /** Prices captured when fitting extras are selected, for stable quote breakdowns. */
  fitExtraPrices?: QuoteAddon[]
  /** Last system-computed unit price (before any manual override). */
  calculatedPrice?: number
  /** The price actually used for totals -- equals calculatedPrice unless manually overridden. Kept in sync with unitPrice. */
  finalPrice?: number
  priceOverridden?: boolean
}

export interface RoomPhoto {
  id: string
  dataUrl: string
  caption: string
}

export interface QuoteCustomer {
  name: string
  address: string
  phone: string
  /** One or more comma-separated customer email addresses. Optional for legacy quotes. */
  email?: string
}

export interface QuoteState {
  items: QuoteLineItem[]
  gstEnabled: boolean
  roomPhotos: Record<string, RoomPhoto[]>
  customer: QuoteCustomer
  shipSameAsBill: boolean
  shipTo: QuoteCustomer
  quoteNo: string
  quoteNumber: string
  quoteDate: string
  frameColour: string
  customFrameColour: string
  colourExtraOverride: number | null
  paid: number
  version: number
  status: QuoteStatus
  dealStatus: DealStatus
  issuedSnapshot: IssuedSnapshot | null
}

export type QuoteAction =
  | { type: 'ADD_ITEM'; item: Omit<QuoteLineItem, 'id'> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_QUANTITY'; id: string; quantity: number }
  | { type: 'UPDATE_ITEM'; id: string; patch: Partial<Omit<QuoteLineItem, 'id'>> }
  | { type: 'SET_GST'; enabled: boolean }
  | { type: 'CLEAR' }
  | { type: 'SET_CUSTOMER'; customer: QuoteCustomer }
  | { type: 'SET_SHIP_TO'; shipTo: QuoteCustomer }
  | { type: 'SET_SHIP_SAME'; same: boolean }
  | { type: 'SET_COLOUR'; frameColour: string }
  | { type: 'SET_CUSTOM_COLOUR'; customFrameColour: string }
  | { type: 'SET_COLOUR_EXTRA'; amount: number | null }
  | { type: 'SET_QUOTE_DATE'; quoteDate: string }
  | { type: 'SET_QUOTE_NUMBER'; quoteNumber: string }
  | { type: 'SET_PAID'; paid: number }
  | { type: 'NEW_QUOTE'; quoteNo: string }
  | { type: 'LOAD_QUOTE'; quote: QuoteState }
  | { type: 'ADD_PHOTO'; room: string; dataUrl: string }
  | { type: 'REMOVE_PHOTO'; room: string; id: string }
  | { type: 'SET_PHOTO_CAPTION'; room: string; id: string; caption: string }
  | { type: 'HYDRATE_PHOTOS'; quoteNo: string; version: number; roomPhotos: Record<string, RoomPhoto[]> }
  | { type: 'ISSUE'; snapshot: IssuedSnapshot }
  | { type: 'REVISE' }
  | { type: 'SET_DEAL_STATUS'; dealStatus: DealStatus }
  | { type: 'SUBMIT_FOR_REVIEW' }

const SEQ_KEY = 'smartquote-pro:quote-seq'

const emptyCustomer: QuoteCustomer = { name: '', address: '', phone: '', email: '' }

function nextQuoteNo(): string {
  try {
    let current = nextSequenceValue(Number(workspaceStorage.getItem(SEQ_KEY) ?? '33020'), '')
    let candidate: string
    do {
      current += 1
      candidate = String(current)
    } while (getArchivedQuote(candidate) || workspaceStorage.getItem(quoteDraftKey(candidate, 1)))
    workspaceStorage.setItem(SEQ_KEY, String(current))
    return candidate
  } catch {
    return String(Date.now()).slice(-8)
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The auto-numbering sequence only advances for purely numeric quote numbers.
 * An alphanumeric quote number (e.g. "A123") would otherwise turn `Number(quoteNo)`
 * into NaN and permanently corrupt every future auto-generated quote number.
 */
export function nextSequenceValue(current: number, quoteNo: string): number {
  const safeCurrent = Number.isSafeInteger(current) && current >= 0 ? current : 33020
  const entered = /^\d+$/.test(quoteNo) ? Number(quoteNo) : NaN
  return Number.isSafeInteger(entered) ? Math.max(safeCurrent, entered) : safeCurrent
}

function defaultState(quoteNo: string): QuoteState {
  return {
    items: [],
    gstEnabled: true,
    roomPhotos: {},
    customer: emptyCustomer,
    shipSameAsBill: true,
    shipTo: emptyCustomer,
    quoteNo,
    quoteNumber: quoteNo,
    quoteDate: todayISO(),
    frameColour: 'White',
    customFrameColour: '',
    colourExtraOverride: null,
    paid: 0,
    version: 1,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
  }
}

/** Legacy items never persisted these fields; backfill them from unitPrice so totals/overrides behave consistently. */
function normalizeItem(item: QuoteLineItem): QuoteLineItem {
  const finalPrice = item.finalPrice ?? item.unitPrice
  const config = item.configurationCode ? findSheetConfig(item.configurationCode) : undefined
  const opening = item.measurements ? openingFromMeasures(item.measurements, config) : null
  const screen = config && item.measurements ? sheetSizeFromMeasures(config, item.measurements) : null
  const measuredWidths = Object.entries(item.measurements ?? {})
    .filter(([key, value]) => key.startsWith('W') && Number(value) > 0)
    .map(([, value]) => Number(value))
  const legacyScreenWidth = config && measuredWidths.length > 0
    ? Math.max(...measuredWidths) / config.widthFactor + config.widthOffset
    : 0
  const pricedWidth = screen
    // Historical detection only: older saved items included the interlock offset.
    // Keep this to recover their original opening, never to price new items.
    ? Math.round(legacyScreenWidth + (item.interlockAdjustment === 'add' ? 5 : item.interlockAdjustment === 'remove' ? -5 : 0))
    : 0
  // The former measurement wizard stored per-panel pricing dimensions in the opening
  // fields. Recover the full dimensions only when the saved measurements prove this.
  const storedPricingSize = Boolean(
    screen && opening && item.openingWidthMm && item.openingHeightMm &&
    item.openingWidthMm === pricedWidth &&
    item.openingHeightMm === Math.round(screen.screenHeight) &&
    (item.openingWidthMm !== Math.round(opening.width) || item.openingHeightMm !== Math.round(opening.height)),
  )
  const oldSuffix = storedPricingSize ? `${padMm(item.openingHeightMm!)} x ${padMm(item.openingWidthMm!)} mm` : ''
  const newSuffix = opening ? `${padMm(opening.height)} x ${padMm(opening.width)} mm` : ''
  return {
    ...item,
    ...(storedPricingSize && opening ? {
      openingWidthMm: Math.round(opening.width),
      openingHeightMm: Math.round(opening.height),
      detail: item.detail === `${item.openingHeightMm} x ${item.openingWidthMm} mm`
        ? formatItemDimensions(opening.height, opening.width) : item.detail,
      description: item.description.endsWith(oldSuffix)
        ? `${item.description.slice(0, -oldSuffix.length)}${newSuffix}` : item.description,
    } : {}),
    categoryKey: item.categoryKey ?? '',
    doubleHung: item.doubleHung ?? false,
    fitExtras: item.fitExtras ?? [],
    calculatedPrice: item.calculatedPrice ?? item.unitPrice,
    finalPrice,
    priceOverridden: item.priceOverridden ?? false,
    unitPrice: finalPrice,
  }
}

export function normalizeQuote(parsed: Partial<QuoteState>, fallbackQuoteNo?: string): QuoteState {
  const quoteNo = parsed.quoteNo || fallbackQuoteNo || nextQuoteNo()
  return {
    ...defaultState(quoteNo),
    items: (parsed.items ?? []).map(normalizeItem),
    gstEnabled: parsed.gstEnabled ?? true,
    roomPhotos: parsed.roomPhotos ?? {},
    customer: { ...emptyCustomer, ...parsed.customer },
    shipSameAsBill: parsed.shipSameAsBill ?? true,
    shipTo: { ...emptyCustomer, ...parsed.shipTo },
    quoteNumber: parsed.quoteNumber?.trim() || quoteNo,
    quoteDate: parsed.quoteDate || todayISO(),
    frameColour: parsed.frameColour || 'White',
    customFrameColour: parsed.customFrameColour ?? '',
    colourExtraOverride: parsed.colourExtraOverride ?? null,
    paid: parsed.paid ?? 0,
    version: Math.max(1, parsed.version ?? 1),
    status:
      parsed.status === 'issued' && parsed.issuedSnapshot
        ? 'issued'
        : parsed.status === 'office-review'
          ? 'office-review'
          : 'draft',
    dealStatus: parseDealStatus(parsed.dealStatus),
    issuedSnapshot: parsed.status === 'issued' && parsed.issuedSnapshot ? parsed.issuedSnapshot : null,
  }
}

/**
 * Deep-clones an archived quote into a brand-new, independent draft: new quote number, fresh
 * lifecycle (draft/open, version 1, no issued snapshot, no payments), and new item ids so the
 * duplicate can never share a mutable reference -- or an id `updateItem` could match -- with the
 * original.
 */
export function buildDuplicatedQuote(source: QuoteState, newQuoteNo: string): QuoteState {
  const cloned = JSON.parse(JSON.stringify(source)) as QuoteState
  return {
    ...cloned,
    quoteNo: newQuoteNo,
    quoteNumber: newQuoteNo,
    version: 1,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
    paid: 0,
    quoteDate: todayISO(),
    items: cloned.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
  }
}

function loadInitialState(): QuoteState {
  try {
    const raw = readTabDraft()
    if (raw) return normalizeQuote(JSON.parse(raw) as Partial<QuoteState>)
  } catch {
    // ignore corrupt storage and start fresh
  }
  return defaultState(nextQuoteNo())
}

export function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  if (isActionLocked(state.status, action.type, state.dealStatus)) return state

  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, normalizeItem({ ...action.item, id: crypto.randomUUID() })] }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) }
    case 'SET_QUANTITY':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, quantity: Math.max(1, action.quantity) } : i)),
      }
    case 'UPDATE_ITEM': {
      const patch = {
        ...action.patch,
        ...(action.patch.quantity !== undefined ? { quantity: Math.max(1, action.patch.quantity) } : {}),
        ...(action.patch.unitPrice !== undefined && action.patch.finalPrice === undefined ? { finalPrice: action.patch.unitPrice } : {}),
      }
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? normalizeItem({ ...i, ...patch }) : i)),
      }
    }
    case 'SET_GST':
      return { ...state, gstEnabled: action.enabled }
    case 'CLEAR':
      return { ...state, items: [], roomPhotos: {} }
    case 'SET_CUSTOMER':
      return { ...state, customer: action.customer }
    case 'SET_SHIP_TO':
      return { ...state, shipTo: action.shipTo }
    case 'SET_SHIP_SAME':
      return { ...state, shipSameAsBill: action.same }
    case 'SET_COLOUR':
      return {
        ...state,
        frameColour: action.frameColour,
        customFrameColour: action.frameColour === OTHER_FRAME_COLOUR ? state.customFrameColour : '',
        colourExtraOverride: null,
      }
    case 'SET_CUSTOM_COLOUR':
      return { ...state, customFrameColour: action.customFrameColour }
    case 'SET_COLOUR_EXTRA':
      return { ...state, colourExtraOverride: action.amount }
    case 'SET_QUOTE_DATE':
      return { ...state, quoteDate: action.quoteDate }
    case 'SET_QUOTE_NUMBER':
      return { ...state, quoteNumber: action.quoteNumber }
    case 'SET_PAID':
      return { ...state, paid: Math.max(0, action.paid) }
    case 'NEW_QUOTE':
      return defaultState(action.quoteNo)
    case 'LOAD_QUOTE':
      return normalizeQuote(action.quote, action.quote.quoteNo)
    case 'ISSUE':
      if (!canIssueQuote(state)) return state
      return { ...state, status: 'issued', issuedSnapshot: action.snapshot }
    case 'REVISE':
      if (state.status !== 'issued' || state.dealStatus !== 'open') return state
      return {
        ...state,
        version: Math.max(1, state.version) + 1,
        status: 'draft',
        issuedSnapshot: null,
        quoteDate: todayISO(),
        paid: 0,
      }
    case 'SET_DEAL_STATUS':
      return { ...state, dealStatus: action.dealStatus }
    case 'SUBMIT_FOR_REVIEW':
      if (!canSubmitForReview(state)) return state
      return { ...state, status: 'office-review' }
    case 'ADD_PHOTO': {
      const photo: RoomPhoto = { id: crypto.randomUUID(), dataUrl: action.dataUrl, caption: '' }
      const existing = state.roomPhotos[action.room] ?? []
      return { ...state, roomPhotos: { ...state.roomPhotos, [action.room]: [...existing, photo] } }
    }
    case 'REMOVE_PHOTO': {
      const existing = state.roomPhotos[action.room] ?? []
      return {
        ...state,
        roomPhotos: { ...state.roomPhotos, [action.room]: existing.filter((p) => p.id !== action.id) },
      }
    }
    case 'SET_PHOTO_CAPTION': {
      const existing = state.roomPhotos[action.room] ?? []
      return {
        ...state,
        roomPhotos: {
          ...state.roomPhotos,
          [action.room]: existing.map((p) => (p.id === action.id ? { ...p, caption: action.caption } : p)),
        },
      }
    }
    case 'HYDRATE_PHOTOS':
      if (action.quoteNo !== state.quoteNo || action.version !== state.version) return state
      return { ...state, roomPhotos: action.roomPhotos }
    default:
      return state
  }
}

export function colourRecord(name: string) {
  return colours.find((c) => c.name === name)
}

export function colourSurcharge(name: string, defaultPrice: number): number {
  return colourRecord(name)?.additionalCharge ? defaultPrice : 0
}

interface QuoteContextValue extends QuoteState {
  addItem: (item: Omit<QuoteLineItem, 'id'>) => boolean
  removeItem: (id: string) => void
  setQuantity: (id: string, quantity: number) => void
  updateItem: (id: string, patch: Partial<Omit<QuoteLineItem, 'id'>>) => void
  setGstEnabled: (enabled: boolean) => void
  setCustomer: (customer: QuoteCustomer) => void
  setShipTo: (shipTo: QuoteCustomer) => void
  setShipSameAsBill: (same: boolean) => void
  setFrameColour: (frameColour: string) => void
  setCustomFrameColour: (customFrameColour: string) => void
  setColourExtraOverride: (amount: number | null) => void
  setQuoteDate: (quoteDate: string) => void
  setQuoteNumber: (quoteNumber: string) => void
  setPaid: (paid: number) => void
  submitForReview: () => Promise<boolean>
  issueQuote: () => Promise<boolean>
  canIssue: boolean
  reviseQuote: (reason?: string) => Promise<boolean>
  /** Starts a fresh draft quote and returns its newly assigned quote number. */
  newQuote: (requestedNo?: string) => Promise<string | null>
  saveCurrentQuote: () => Promise<ArchiveWriteResult>
  saveAsSeparateQuote: () => Promise<ArchiveWriteResult>
  loadSavedQuote: (quoteNo: string, version?: number) => boolean
  /** Deep-clones an archived quote into a brand-new, independent draft (new quote number, new item ids, fresh lifecycle). Returns the new quote number, or null if the source can't be found. */
  duplicateQuote: (quoteNo: string, version?: number) => Promise<string | null>
  deleteSavedQuote: (quoteNo: string, version: number) => Promise<void>
  addSavedQuoteComment: (quoteNo: string, version: number, text: string) => Promise<boolean>
  setQuoteDealStatus: (quoteNo: string, dealStatus: DealStatus) => Promise<void>
  writeSavedQuote: <T>(quoteNo: string, write: () => T) => Promise<T>
  canEdit: boolean
  editPending: boolean
  retryEditing: () => void
  refreshSavedQuotes: () => void
  archiveStorageError: string | null
  ownsQuoteEditing: (quoteNo: string) => boolean
  loadDraftQuote: (quoteNo: string, version: number) => boolean
  savedQuotes: ArchivedQuote[]
  clear: () => void
  addPhoto: (room: string, dataUrl: string) => void
  removePhoto: (room: string, id: string) => void
  setPhotoCaption: (room: string, id: string, caption: string) => void
  colourExtra: number
  subtotal: number
  gstAmount: number
  total: number
  deposit: number
  balance: number
  photoStorageError: string | null
  retryPhotoStorage: () => void
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const { settings } = useCompanySettings()
  const { user, isAdmin } = useAuth()
  const [state, dispatch] = useReducer(quoteReducer, undefined, loadInitialState)
  const [savedQuotes, setSavedQuotes] = useState<ArchivedQuote[]>(() => {
    try {
      return listArchivedQuotes()
    } catch {
      return []
    }
  })
  const [archiveStorageError, setArchiveStorageError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      try { setSavedQuotes(listArchivedQuotes()); setArchiveStorageError(null) }
      catch (error) { setArchiveStorageError(error instanceof Error ? error.message : 'Could not read saved quotes.') }
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener(SERVER_DATA_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(SERVER_DATA_EVENT, refresh)
    }
  }, [])

  const stateRef = useRef(state)
  stateRef.current = state
  const { canEdit: editAllowed, pending: editPending, owns: ownsEdit, retry: retryEdit } = useQuoteEditLock(state.quoteNo)
  const [photosReadyFor, setPhotosReadyFor] = useState<string | null>(null)
  const loadedPhotoScope = useRef<string | null>(null)
  const [photoStorageError, setPhotoStorageError] = useState<string | null>(null)
  const [photoReload, setPhotoReload] = useState(0)
  const photoScope = JSON.stringify([state.quoteNo, state.version])
  useEffect(() => { pinQuote(state.quoteNo) }, [state.quoteNo])

  useEffect(() => {
    if (!editAllowed || !user || user.mustChangePassword) return
    const persist = () => {
      try {
        persistDraftQuote(state, workspaceStorage, {
          log: true,
          includePhotos: MEASURE_LEGACY_DRAFT_PERSIST,
          scoped: true,
        })
        if (SERVER_MODE) void saveRemoteDraft(stripRoomPhotoData(state) as unknown as Record<string, unknown>).catch(reportSyncError)
      } catch {
        // Quota or private-mode storage; keep editing in memory.
      }
    }

    if (MEASURE_LEGACY_DRAFT_PERSIST) {
      persist()
      return
    }

    const timer = window.setTimeout(persist, DRAFT_PERSIST_MS)
    return () => window.clearTimeout(timer)
  }, [state, editAllowed, user])

  useEffect(() => {
    const flush = () => {
      if (!user || user.mustChangePassword || (SERVER_MODE && !readToken())) return
      if (!ownsEdit(stateRef.current.quoteNo)) return
      try {
        persistDraftQuote(stateRef.current, workspaceStorage, {
          log: true,
          includePhotos: MEASURE_LEGACY_DRAFT_PERSIST,
          scoped: true,
        })
      } catch {
        // ignore
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [ownsEdit, user])

  useEffect(() => {
    let cancelled = false
    const quoteNo = state.quoteNo
    const version = state.version || 1
    const scope = JSON.stringify([quoteNo, version])
    loadedPhotoScope.current = null
    setPhotoStorageError(null)
    void (async () => {
      try {
        const stored = await loadRoomPhotos(quoteNo, version)
        if (cancelled || stateRef.current.quoteNo !== quoteNo || stateRef.current.version !== version) return
        const restored = restoreRoomPhotoData(stateRef.current.roomPhotos, stored)
        loadedPhotoScope.current = scope
        dispatch({ type: 'HYDRATE_PHOTOS', quoteNo, version, roomPhotos: restored })
        setPhotosReadyFor(scope)
      } catch {
        if (!cancelled) setPhotoStorageError('Could not load saved room photos. Keep this page open and try again after browser storage is available.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.quoteNo, state.version, photoReload])

  useEffect(() => {
    if (!user || user.mustChangePassword || !editAllowed || photosReadyFor !== photoScope || loadedPhotoScope.current !== photoScope) return
    let cancelled = false
    void saveRoomPhotos(state.quoteNo, state.roomPhotos, state.version).then(() => {
      if (!cancelled) setPhotoStorageError(null)
    }).catch(() => {
      if (!cancelled) setPhotoStorageError('Room photos could not be saved. Keep this page open and free up browser storage before leaving.')
    })
    return () => { cancelled = true }
  }, [photosReadyFor, photoScope, state.quoteNo, state.version, state.roomPhotos, editAllowed, user])

  const value = useMemo<QuoteContextValue>(() => {
    const writeCurrent = <T,>(write: () => T) => withQuoteWriteAccess(state.quoteNo, ownsEdit, () => {
      if (!ownsEdit(state.quoteNo)) throw new Error('This quote is read-only in this tab. Choose Edit in this tab first.')
      if (JSON.stringify(stateRef.current) !== JSON.stringify(state)) throw new Error('The quote changed while saving. Try again.')
      return write()
    })
    const defaultExtra = colourSurcharge(state.frameColour, settings.nonStandardColourPrice)
    const liveColourExtra = defaultExtra > 0 ? (state.colourExtraOverride ?? defaultExtra) : 0
    const { colourExtra, subtotal, gstAmount, total, deposit, balance } = quoteFinancials(state, {
      colourExtra: liveColourExtra,
      depositRate: settings.depositRate,
    })
    const persistCurrentQuote = () => {
      const result = upsertArchivedQuote(state, { total })
      try {
        persistDraftQuote(state, workspaceStorage, { scoped: true })
      } catch {
        // The archive is saved even when draft storage is unavailable.
      }
      setSavedQuotes(listArchivedQuotes())
      return result
    }
    const persistTransition = (quote: QuoteState) => {
      try {
        persistDraftQuote(quote, workspaceStorage, { scoped: true })
      } catch {
        // The transition is already archived; it can still be reopened from Quotes.
      }
    }
    return {
      ...state,
      addItem: (item) => {
        if (!ownsEdit(state.quoteNo) || isActionLocked(state.status, 'ADD_ITEM', state.dealStatus)) return false
        dispatch({ type: 'ADD_ITEM', item })
        return true
      },
      removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', id }),
      setQuantity: (id, quantity) => dispatch({ type: 'SET_QUANTITY', id, quantity }),
      updateItem: (id, patch) => dispatch({ type: 'UPDATE_ITEM', id, patch }),
      setGstEnabled: (enabled) => dispatch({ type: 'SET_GST', enabled }),
      setCustomer: (customer) => dispatch({ type: 'SET_CUSTOMER', customer }),
      setShipTo: (shipTo) => dispatch({ type: 'SET_SHIP_TO', shipTo }),
      setShipSameAsBill: (same) => dispatch({ type: 'SET_SHIP_SAME', same }),
      setFrameColour: (frameColour) => dispatch({ type: 'SET_COLOUR', frameColour }),
      setCustomFrameColour: (customFrameColour) => dispatch({ type: 'SET_CUSTOM_COLOUR', customFrameColour }),
      setColourExtraOverride: (amount) => dispatch({ type: 'SET_COLOUR_EXTRA', amount }),
      setQuoteDate: (quoteDate) => dispatch({ type: 'SET_QUOTE_DATE', quoteDate }),
      setQuoteNumber: (quoteNumber) => dispatch({ type: 'SET_QUOTE_NUMBER', quoteNumber }),
      setPaid: (paid) => dispatch({ type: 'SET_PAID', paid }),
      submitForReview: async () => {
        if (!user) return false
        try {
          await writeCurrent(() => submitQuoteForReview(state, user.id, { colourExtra: liveColourExtra, depositRate: settings.depositRate }))
        } catch {
          return false
        }
        setSavedQuotes(listArchivedQuotes())
        persistTransition({ ...state, status: 'office-review' })
        dispatch({ type: 'LOAD_QUOTE', quote: { ...state, status: 'office-review' } })
        return true
      },
      canIssue: editAllowed && Boolean(user) && canIssueReviewedQuote(state, isAdmin, { colourExtra: liveColourExtra, depositRate: settings.depositRate }),
      issueQuote: async () => {
        if (!user || !canIssueReviewedQuote(state, isAdmin, { colourExtra: liveColourExtra, depositRate: settings.depositRate })) return false
        const snapshot = createIssuedSnapshot(state, liveColourExtra, settings.depositRate, undefined, settings)
        const issued = { ...state, status: 'issued' as const, issuedSnapshot: snapshot }
        try {
          await writeCurrent(() => upsertArchivedQuote(issued, { total: snapshot.total }))
          setSavedQuotes(listArchivedQuotes())
        } catch {
          return false
        }
        persistTransition(issued)
        dispatch({ type: 'ISSUE', snapshot })
        return true
      },
      reviseQuote: async (reason) => {
        if (!canReviseQuote(state)) return false
        const revised: QuoteState = {
          ...state,
          version: Math.max(1, state.version || 1) + 1,
          status: 'draft',
          issuedSnapshot: null,
          quoteDate: new Date().toISOString().slice(0, 10),
          paid: 0,
        }
        try {
          await writeCurrent(() => withStorageRollback(workspaceStorage, [ARCHIVE_KEY], () => {
            upsertArchivedQuote(state, { total })
            upsertArchivedQuote(revised, { total })
            if (reason?.trim()) addArchivedQuoteComment(revised.quoteNo, revised.version, reason)
          }))
          setSavedQuotes(listArchivedQuotes())
        } catch {
          return false
        }
        persistTransition(revised)
        dispatch({ type: 'LOAD_QUOTE', quote: revised })
        return true
      },
      newQuote: (requestedNo) => withQuoteStorageLock(async () => {
        if (ownsEdit(state.quoteNo)) persistTransition(state)
        const quoteNo = SERVER_MODE ? await allocateQuoteNumber(requestedNo?.trim() || undefined) : requestedNo ? requestedNo.trim() : nextQuoteNo()
        if (
          getArchivedQuote(quoteNo) || (workspaceStorage.getItem(quoteDraftKey(quoteNo, 1)) && !(quoteNo === state.quoteNo && !state.items.length && !state.customer.name.trim() && ownsEdit(quoteNo))) ||
          (quoteNo === state.quoteNo && (state.items.length > 0 || Boolean(state.customer.name.trim())))
        ) return null
        if (requestedNo) {
          try {
            const current = Number(workspaceStorage.getItem(SEQ_KEY) ?? '33020')
            workspaceStorage.setItem(SEQ_KEY, String(nextSequenceValue(current, quoteNo)))
          } catch {
            // Browser storage may be unavailable; the quote remains usable in memory.
          }
        }
        dispatch({ type: 'NEW_QUOTE', quoteNo })
        return quoteNo
      }),
      saveCurrentQuote: () => writeCurrent(persistCurrentQuote),
      saveAsSeparateQuote: () => withQuoteStorageLock(async () => {
        if (JSON.stringify(stateRef.current) !== JSON.stringify(state)) throw new Error('The quote changed while saving. Try again.')
        const newQuoteNo = SERVER_MODE ? await allocateQuoteNumber() : nextQuoteNo()
        const separate = buildDuplicatedQuote(state, newQuoteNo)
        // The customer-facing number must also identify the new quote.
        separate.quoteNumber = newQuoteNo
        const financials = quoteFinancials(separate, {
          colourExtra: liveColourExtra,
          depositRate: settings.depositRate,
        })
        // Only switch away from the edited quote after the archive write succeeds.
        const result = upsertArchivedQuote(separate, { total: financials.total })
        try {
          persistDraftQuote(separate, workspaceStorage, { scoped: true })
        } catch {
          // The archive is saved even when draft storage is unavailable.
        }
        setSavedQuotes(listArchivedQuotes())
        dispatch({ type: 'LOAD_QUOTE', quote: separate })
        return result
      }),
      loadSavedQuote: (quoteNo, version) => {
        const record = getArchivedQuote(quoteNo, version)
        if (!record) return false
        reloadPinnedQuote(quoteNo)
        if (ownsEdit(state.quoteNo)) persistTransition(state)
        loadedPhotoScope.current = null
        setPhotosReadyFor(null)
        setPhotoReload((current) => current + 1)
        dispatch({ type: 'LOAD_QUOTE', quote: record.quote })
        return true
      },
      duplicateQuote: (quoteNo, version) => withQuoteStorageLock(async () => {
        const record = getArchivedQuote(quoteNo, version)
        if (!record) return null
        const newQuoteNo = SERVER_MODE ? await allocateQuoteNumber() : nextQuoteNo()
        const duplicated = buildDuplicatedQuote(record.quote, newQuoteNo)
        try {
          const extra = colourSurcharge(duplicated.frameColour, settings.nonStandardColourPrice)
          const financials = quoteFinancials(duplicated, {
            colourExtra: extra > 0 ? (duplicated.colourExtraOverride ?? extra) : 0,
            depositRate: settings.depositRate,
          })
          upsertArchivedQuote(duplicated, { total: financials.total })
          setSavedQuotes(listArchivedQuotes())
        } catch {
          return null
        }
        return newQuoteNo
      }),
      deleteSavedQuote: (quoteNo, version) => withQuoteWriteAccess(quoteNo, ownsEdit, () => {
        deleteArchivedQuote(quoteNo, version)
        setSavedQuotes(listArchivedQuotes())
      }),
      addSavedQuoteComment: (quoteNo, version, text) => withQuoteWriteAccess(quoteNo, ownsEdit, () => {
        const comment = addArchivedQuoteComment(quoteNo, version, text)
        if (!comment) return false
        setSavedQuotes(listArchivedQuotes())
        return true
      }),
      setQuoteDealStatus: async (quoteNo, dealStatus) => {
        await withQuoteWriteAccess(quoteNo, ownsEdit, () => {
          setArchivedQuoteDealStatus(quoteNo, dealStatus)
        })
        setSavedQuotes(listArchivedQuotes())
        if (state.quoteNo === quoteNo) dispatch({ type: 'SET_DEAL_STATUS', dealStatus })
      },
      writeSavedQuote: (quoteNo, write) => withQuoteWriteAccess(quoteNo, ownsEdit, write),
      canEdit: editAllowed,
      editPending: editPending,
      retryEditing: async () => {
        if (SERVER_MODE) {
          try { await refreshWorkspace(true); reloadPinnedQuote(state.quoteNo) }
          catch (error) { reportSyncError(error); return }
        }
        const raw = workspaceStorage.getItem(quoteDraftKey(state.quoteNo, state.version))
        if (raw) {
          try {
            const latest=normalizeQuote(JSON.parse(raw), state.quoteNo)
            persistDraftQuote(latest,workspaceStorage,{scoped:true})
            dispatch({ type: 'LOAD_QUOTE', quote: latest })
          } catch { /* Keep current view. */ }
        }
        setPhotoReload((current) => current + 1)
        retryEdit()
      },
      refreshSavedQuotes: () => setSavedQuotes(listArchivedQuotes()),
      archiveStorageError,
      ownsQuoteEditing: ownsEdit,
      loadDraftQuote: (quoteNo, version) => {
        const raw = workspaceStorage.getItem(quoteDraftKey(quoteNo, version))
        if (!raw) return false
        reloadPinnedQuote(quoteNo)
        if (ownsEdit(state.quoteNo)) persistTransition(state)
        loadedPhotoScope.current = null
        setPhotosReadyFor(null)
        setPhotoReload((current) => current + 1)
        dispatch({ type: 'LOAD_QUOTE', quote: normalizeQuote(JSON.parse(raw), quoteNo) })
        return true
      },
      savedQuotes,
      clear: () => dispatch({ type: 'CLEAR' }),
      addPhoto: (room, dataUrl) => {
        if (ownsEdit(state.quoteNo) && stateRef.current.quoteNo === state.quoteNo) dispatch({ type: 'ADD_PHOTO', room, dataUrl })
      },
      removePhoto: (room, id) => dispatch({ type: 'REMOVE_PHOTO', room, id }),
      setPhotoCaption: (room, id, caption) => dispatch({ type: 'SET_PHOTO_CAPTION', room, id, caption }),
      colourExtra,
      subtotal,
      gstAmount,
      total,
      deposit,
      balance,
      photoStorageError,
      retryPhotoStorage: () => setPhotoReload((current) => current + 1),
    }
  }, [savedQuotes, settings, state, user, isAdmin, photoStorageError, editAllowed, editPending, ownsEdit, retryEdit, archiveStorageError])

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuote must be used within a QuoteProvider')
  return ctx
}
