import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import colours from '../data/colours.json'
import {
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
import { deleteRoomPhotos, loadRoomPhotos, saveRoomPhotos } from './quotePhotoStore'
import { DRAFT_PERSIST_MS, DRAFT_STORAGE_KEY, MEASURE_LEGACY_DRAFT_PERSIST, hasPhotoData, persistDraftQuote } from './quotePersist'
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
  productKey?: string
  // Structured fields for items built through the opening/item wizard.
  // All optional so legacy flat items (description/detail/room only) keep working unchanged.
  location?: string
  configurationCode?: string
  measurements?: Record<string, string>
  lockHeightMm?: number | null
  lockSide?: 'left' | 'right' | ''
  centreTongue?: boolean
  bowed?: boolean
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
  | { type: 'HYDRATE_PHOTOS'; roomPhotos: Record<string, RoomPhoto[]> }
  | { type: 'ISSUE'; snapshot: IssuedSnapshot }
  | { type: 'REVISE' }
  | { type: 'SET_DEAL_STATUS'; dealStatus: DealStatus }
  | { type: 'SUBMIT_FOR_REVIEW' }

const SEQ_KEY = 'smartquote-pro:quote-seq'

const emptyCustomer: QuoteCustomer = { name: '', address: '', phone: '' }

function nextQuoteNo(): string {
  try {
    let current = Number(localStorage.getItem(SEQ_KEY) ?? '33020')
    let candidate: string
    do {
      current += 1
      candidate = String(current)
    } while (getArchivedQuote(candidate))
    localStorage.setItem(SEQ_KEY, String(current))
    return candidate
  } catch {
    return String(Date.now()).slice(-8)
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
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
    quoteNumber: '',
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
  return {
    ...item,
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
    quoteNumber: parsed.quoteNumber ?? '',
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
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
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
      return { ...state, items: [...state.items, { ...action.item, id: crypto.randomUUID() }] }
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
      }
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, ...patch } : i)),
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
  submitForReview: () => boolean
  issueQuote: () => boolean
  reviseQuote: (reason?: string) => boolean
  /** Starts a fresh draft quote and returns its newly assigned quote number. */
  newQuote: (requestedNo?: string) => string | null
  saveCurrentQuote: () => ArchiveWriteResult
  loadSavedQuote: (quoteNo: string, version?: number) => boolean
  /** Deep-clones an archived quote into a brand-new, independent draft (new quote number, new item ids, fresh lifecycle). Returns the new quote number, or null if the source can't be found. */
  duplicateQuote: (quoteNo: string, version?: number) => string | null
  deleteSavedQuote: (quoteNo: string, version: number) => void
  addSavedQuoteComment: (quoteNo: string, version: number, text: string) => boolean
  setQuoteDealStatus: (quoteNo: string, dealStatus: DealStatus) => void
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
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const { settings } = useCompanySettings()
  const [state, dispatch] = useReducer(quoteReducer, undefined, loadInitialState)
  const [savedQuotes, setSavedQuotes] = useState<ArchivedQuote[]>(() => {
    try {
      return listArchivedQuotes()
    } catch {
      return []
    }
  })

  const stateRef = useRef(state)
  stateRef.current = state
  const draftKeyRef = useRef({ quoteNo: state.quoteNo, version: state.version || 1 })

  useEffect(() => {
    const persist = () => {
      try {
        persistDraftQuote(state, localStorage, {
          log: true,
          includePhotos: MEASURE_LEGACY_DRAFT_PERSIST,
        })
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
  }, [state])

  useEffect(() => {
    return () => {
      try {
        persistDraftQuote(stateRef.current, localStorage, {
          log: true,
          includePhotos: MEASURE_LEGACY_DRAFT_PERSIST,
        })
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    const previous = draftKeyRef.current
    if (previous.quoteNo !== state.quoteNo) {
      void deleteRoomPhotos(previous.quoteNo, previous.version).catch(() => undefined)
    }
    draftKeyRef.current = { quoteNo: state.quoteNo, version: state.version || 1 }
    void saveRoomPhotos(state.quoteNo, state.roomPhotos, state.version || 1).catch(() => undefined)
  }, [state.quoteNo, state.version, state.roomPhotos])

  useEffect(() => {
    let cancelled = false
    const quoteNo = state.quoteNo
    const version = state.version || 1
    const photos = state.roomPhotos
    void (async () => {
      try {
        if (hasPhotoData(photos)) {
          await saveRoomPhotos(quoteNo, photos, version)
          return
        }
        const stored = await loadRoomPhotos(quoteNo, version)
        if (cancelled || !stored || !hasPhotoData(stored)) return
        dispatch({ type: 'HYDRATE_PHOTOS', roomPhotos: stored })
      } catch {
        // IndexedDB unavailable; photos stay in memory only.
      }
    })()
    return () => {
      cancelled = true
    }
    // Hydrate once from disk after the first paint; later photo edits go through the reducer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<QuoteContextValue>(() => {
    const defaultExtra = colourSurcharge(state.frameColour, settings.nonStandardColourPrice)
    const liveColourExtra = defaultExtra > 0 ? (state.colourExtraOverride ?? defaultExtra) : 0
    const { colourExtra, subtotal, gstAmount, total, deposit, balance } = quoteFinancials(state, {
      colourExtra: liveColourExtra,
      depositRate: settings.depositRate,
    })
    return {
      ...state,
      addItem: (item) => {
        if (isActionLocked(state.status, 'ADD_ITEM', state.dealStatus)) return false
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
      submitForReview: () => {
        if (!canSubmitForReview(state) || !state.customer.name.trim() || !state.customer.address.trim()) return false
        dispatch({ type: 'SUBMIT_FOR_REVIEW' })
        return true
      },
      issueQuote: () => {
        if (!canIssueQuote(state)) return false
        const snapshot = createIssuedSnapshot(state, liveColourExtra, settings.depositRate)
        dispatch({ type: 'ISSUE', snapshot })
        const issued = { ...state, status: 'issued' as const, issuedSnapshot: snapshot }
        try {
          upsertArchivedQuote(issued, { total: snapshot.total })
          setSavedQuotes(listArchivedQuotes())
        } catch {
          // Keep the in-memory issued quote even if the archive write fails.
        }
        return true
      },
      reviseQuote: (reason) => {
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
          upsertArchivedQuote(state, { total })
          upsertArchivedQuote(revised, { total })
          if (reason?.trim()) addArchivedQuoteComment(revised.quoteNo, revised.version, reason)
          setSavedQuotes(listArchivedQuotes())
        } catch {
          // Keep going so the staff can still edit the new revision in memory.
        }
        dispatch({ type: 'LOAD_QUOTE', quote: revised })
        return true
      },
      newQuote: (requestedNo) => {
        const quoteNo = requestedNo ? requestedNo.trim() : nextQuoteNo()
        if (
          getArchivedQuote(quoteNo) ||
          (quoteNo === state.quoteNo && (state.items.length > 0 || Boolean(state.customer.name.trim())))
        ) return null
        if (requestedNo) {
          try {
            const current = Number(localStorage.getItem(SEQ_KEY) ?? '33020')
            localStorage.setItem(SEQ_KEY, String(Math.max(current, Number(quoteNo))))
          } catch {
            // Browser storage may be unavailable; the quote remains usable in memory.
          }
        }
        dispatch({ type: 'NEW_QUOTE', quoteNo })
        return quoteNo
      },
      saveCurrentQuote: () => {
        const result = upsertArchivedQuote(state, { total })
        setSavedQuotes(listArchivedQuotes())
        return result
      },
      loadSavedQuote: (quoteNo, version) => {
        const record = getArchivedQuote(quoteNo, version)
        if (!record) return false
        dispatch({ type: 'LOAD_QUOTE', quote: record.quote })
        return true
      },
      duplicateQuote: (quoteNo, version) => {
        const record = getArchivedQuote(quoteNo, version)
        if (!record) return null
        const newQuoteNo = nextQuoteNo()
        const duplicated = buildDuplicatedQuote(record.quote, newQuoteNo)
        try {
          const financials = quoteFinancials(duplicated, { colourExtra: 0, depositRate: settings.depositRate })
          upsertArchivedQuote(duplicated, { total: financials.total })
          setSavedQuotes(listArchivedQuotes())
        } catch {
          // Archive write failed; the caller can still navigate to the new quote number in memory.
        }
        return newQuoteNo
      },
      deleteSavedQuote: (quoteNo, version) => {
        deleteArchivedQuote(quoteNo, version)
        setSavedQuotes(listArchivedQuotes())
      },
      addSavedQuoteComment: (quoteNo, version, text) => {
        const comment = addArchivedQuoteComment(quoteNo, version, text)
        if (!comment) return false
        setSavedQuotes(listArchivedQuotes())
        return true
      },
      setQuoteDealStatus: (quoteNo, dealStatus) => {
        setArchivedQuoteDealStatus(quoteNo, dealStatus)
        setSavedQuotes(listArchivedQuotes())
        if (state.quoteNo === quoteNo) dispatch({ type: 'SET_DEAL_STATUS', dealStatus })
      },
      savedQuotes,
      clear: () => dispatch({ type: 'CLEAR' }),
      addPhoto: (room, dataUrl) => dispatch({ type: 'ADD_PHOTO', room, dataUrl }),
      removePhoto: (room, id) => dispatch({ type: 'REMOVE_PHOTO', room, id }),
      setPhotoCaption: (room, id, caption) => dispatch({ type: 'SET_PHOTO_CAPTION', room, id, caption }),
      colourExtra,
      subtotal,
      gstAmount,
      total,
      deposit,
      balance,
    }
  }, [savedQuotes, settings.depositRate, settings.nonStandardColourPrice, state])

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuote must be used within a QuoteProvider')
  return ctx
}
