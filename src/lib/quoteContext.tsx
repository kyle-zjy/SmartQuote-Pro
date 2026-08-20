import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'

export interface QuoteLineItem {
  id: string
  description: string
  detail: string
  quantity: number
  unitPrice: number
}

interface QuoteState {
  items: QuoteLineItem[]
  gstEnabled: boolean
}

type QuoteAction =
  | { type: 'ADD_ITEM'; item: Omit<QuoteLineItem, 'id'> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_QUANTITY'; id: string; quantity: number }
  | { type: 'SET_GST'; enabled: boolean }
  | { type: 'CLEAR' }

const STORAGE_KEY = 'smartquote-pro:quote'
const GST_RATE = 0.1

function loadInitialState(): QuoteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as QuoteState
  } catch {
    // ignore corrupt storage and start fresh
  }
  return { items: [], gstEnabled: true }
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
      return { ...state, items: [] }
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
