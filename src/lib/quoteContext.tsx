import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'

export interface QuoteLineItem {
  id: string
  description: string
  detail: string
  quantity: number
  unitPrice: number
  room: string
  note: string
}

export interface RoomPhoto {
  id: string
  dataUrl: string
  annotatedDataUrl: string | null
}

interface QuoteState {
  items: QuoteLineItem[]
  gstEnabled: boolean
  roomPhotos: Record<string, RoomPhoto[]>
}

type QuoteAction =
  | { type: 'ADD_ITEM'; item: Omit<QuoteLineItem, 'id'> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_QUANTITY'; id: string; quantity: number }
  | { type: 'SET_GST'; enabled: boolean }
  | { type: 'CLEAR' }
  | { type: 'ADD_PHOTO'; room: string; dataUrl: string }
  | { type: 'REMOVE_PHOTO'; room: string; id: string }
  | { type: 'SET_PHOTO_ANNOTATION'; room: string; id: string; annotatedDataUrl: string | null }

const STORAGE_KEY = 'smartquote-pro:quote'
const GST_RATE = 0.1

function loadInitialState(): QuoteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QuoteState>
      return { items: parsed.items ?? [], gstEnabled: parsed.gstEnabled ?? true, roomPhotos: parsed.roomPhotos ?? {} }
    }
  } catch {
    // ignore corrupt storage and start fresh
  }
  return { items: [], gstEnabled: true, roomPhotos: {} }
}

function reducer(state: QuoteState, action: QuoteAction): QuoteState {
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
    case 'SET_GST':
      return { ...state, gstEnabled: action.enabled }
    case 'CLEAR':
      return { ...state, items: [], roomPhotos: {} }
    case 'ADD_PHOTO': {
      const photo: RoomPhoto = { id: crypto.randomUUID(), dataUrl: action.dataUrl, annotatedDataUrl: null }
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
    case 'SET_PHOTO_ANNOTATION': {
      const existing = state.roomPhotos[action.room] ?? []
      return {
        ...state,
        roomPhotos: {
          ...state.roomPhotos,
          [action.room]: existing.map((p) =>
            p.id === action.id ? { ...p, annotatedDataUrl: action.annotatedDataUrl } : p,
          ),
        },
      }
    }
    default:
      return state
  }
}

interface QuoteContextValue extends QuoteState {
  addItem: (item: Omit<QuoteLineItem, 'id'>) => void
  removeItem: (id: string) => void
  setQuantity: (id: string, quantity: number) => void
  setGstEnabled: (enabled: boolean) => void
  clear: () => void
  addPhoto: (room: string, dataUrl: string) => void
  removePhoto: (room: string, id: string) => void
  setPhotoAnnotation: (room: string, id: string, annotatedDataUrl: string | null) => void
  subtotal: number
  gstAmount: number
  total: number
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo<QuoteContextValue>(() => {
    const subtotal = state.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    const gstAmount = state.gstEnabled ? subtotal * GST_RATE : 0
    return {
      ...state,
      addItem: (item) => dispatch({ type: 'ADD_ITEM', item }),
      removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', id }),
      setQuantity: (id, quantity) => dispatch({ type: 'SET_QUANTITY', id, quantity }),
      setGstEnabled: (enabled) => dispatch({ type: 'SET_GST', enabled }),
      clear: () => dispatch({ type: 'CLEAR' }),
      addPhoto: (room, dataUrl) => dispatch({ type: 'ADD_PHOTO', room, dataUrl }),
      removePhoto: (room, id) => dispatch({ type: 'REMOVE_PHOTO', room, id }),
      setPhotoAnnotation: (room, id, annotatedDataUrl) =>
        dispatch({ type: 'SET_PHOTO_ANNOTATION', room, id, annotatedDataUrl }),
      subtotal,
      gstAmount,
      total: subtotal + gstAmount,
    }
  }, [state])

  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext)
  if (!ctx) throw new Error('useQuote must be used within a QuoteProvider')
  return ctx
}
