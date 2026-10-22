import { workspaceStorage } from './workspaceStorage'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import pricingDefault from '../data/pricing.json'
import addonsDefault from '../data/addons.json'
import type { AddonItem, PricingData } from '../types/pricing'
import { SERVER_DATA_EVENT, SERVER_MODE } from './apiClient'
import { sharedRecordRevision, saveSharedSetting } from './serverWorkspace'
const DEFAULT_DATA = pricingDefault as PricingData
const DEFAULT_ADDONS = addonsDefault as AddonItem[]
interface PricingState {
  data: PricingData
  addons: AddonItem[]
  source: 'default' | 'imported'
  fileName: string | null
}
interface PricingContextValue extends PricingState {
  importFromFile: (file: File) => Promise<{ warnings: string[] }>
  resetToDefault: () => Promise<void>
  saveAddons: (addons: AddonItem[]) => Promise<void>
}
const PricingContext = createContext<PricingContextValue | null>(null)
const initialState: PricingState = {
  data: DEFAULT_DATA,
  addons: DEFAULT_ADDONS,
  source: 'default',
  fileName: null,
}
const KEY = 'smartquote-pro:pricing'
function readPricing() {
  try {
    return (JSON.parse(workspaceStorage.getItem(KEY) ?? 'null') as PricingState) ?? initialState
  } catch {
    /* Use built-in defaults. */
  }
  return initialState
}
export function PricingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PricingState>(readPricing)
  useEffect(() => {
    const refresh = () => setState(readPricing())
    window.addEventListener(SERVER_DATA_EVENT, refresh)
    return () => window.removeEventListener(SERVER_DATA_EVENT, refresh)
  }, [])
  const value = useMemo<PricingContextValue>(
    () => ({
      ...state,
      saveAddons: async (addons) => {
        const names = addons.map((item) => item.name.trim().toLowerCase())
        if (names.some((name) => !name) || new Set(names).size !== names.length)
          throw new Error('Use a unique, non-empty name for every add-on.')
        if (addons.some((item) => item.price === null ? !item.priceOnRequest : !Number.isFinite(item.price) || item.price < 0))
          throw new Error('Enter a price of zero or greater, or select price on request.')
        const next = { ...state, addons }
        if (SERVER_MODE) await saveSharedSetting('pricing', next, sharedRecordRevision('pricing'))
        else workspaceStorage.setItem(KEY, JSON.stringify(next))
        setState(next)
      },
      importFromFile: async (file) => {
        const expected = sharedRecordRevision('pricing')
        const { parseExcelFile } = await import('./xlsxImport')
        const result = await parseExcelFile(file)
        const next: PricingState = {
          data: result.data,
          addons: result.addons.length ? result.addons : state.addons,
          source: 'imported',
          fileName: file.name,
        }
        if (SERVER_MODE) await saveSharedSetting('pricing', next, expected)
        else workspaceStorage.setItem(KEY, JSON.stringify(next))
        setState(next)
        return { warnings: result.warnings }
      },
      resetToDefault: async () => {
        if (SERVER_MODE)
          await saveSharedSetting('pricing', initialState, sharedRecordRevision('pricing'))
        else workspaceStorage.removeItem(KEY)
        setState(initialState)
      },
    }),
    [state],
  )
  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
}
export function usePricing() {
  const value = useContext(PricingContext)
  if (!value) throw new Error('usePricing must be used within PricingProvider')
  return value
}
