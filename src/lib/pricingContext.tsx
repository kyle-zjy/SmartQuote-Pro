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
  if (SERVER_MODE) {
    try {
      return (JSON.parse(workspaceStorage.getItem(KEY) ?? 'null') as PricingState) ?? initialState
    } catch {
      /* Use built-in defaults. */
    }
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
        setState(next)
        return { warnings: result.warnings }
      },
      resetToDefault: async () => {
        if (SERVER_MODE)
          await saveSharedSetting('pricing', initialState, sharedRecordRevision('pricing'))
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
