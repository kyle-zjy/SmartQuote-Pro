import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import pricingDefault from '../data/pricing.json'
import addonsDefault from '../data/addons.json'
import type { AddonItem, PricingData } from '../types/pricing'

const DEFAULT_DATA = pricingDefault as PricingData
const DEFAULT_ADDONS = addonsDefault as AddonItem[]

interface PricingState {
  data: PricingData
  addons: AddonItem[]
  source: 'default' | 'imported'
  fileName: string | null
}

// Feels like (1) Unsafe as hell and (2) Unnecessary on to be sessiononly. 
// Could instead make it an admin function that changes it for everyone on next system reboot.
interface PricingContextValue extends PricingState {
  /** Parses the file client-side and swaps it in for the rest of this browser session only. */
  importFromFile: (file: File) => Promise<{ warnings: string[] }>
  resetToDefault: () => void
}

const PricingContext = createContext<PricingContextValue | null>(null)

const initialState: PricingState = {
  data: DEFAULT_DATA,
  addons: DEFAULT_ADDONS,
  source: 'default',
  fileName: null,
}

export function PricingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PricingState>(initialState)

  const value = useMemo<PricingContextValue>(
    () => ({
      ...state,
      importFromFile: async (file: File) => {
        const { parseExcelFile } = await import('./xlsxImport')
        const result = await parseExcelFile(file)
        setState((prev) => ({
          data: result.data,
          // A missing/unrecognized addons sheet shouldn't wipe out addons that were working before.
          addons: result.addons.length > 0 ? result.addons : prev.addons,
          source: 'imported',
          fileName: file.name,
        }))
        return { warnings: result.warnings }
      },
      resetToDefault: () => setState(initialState),
    }),
    [state],
  )

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
}

export function usePricing(): PricingContextValue {
  const ctx = useContext(PricingContext)
  if (!ctx) throw new Error('usePricing must be used within a PricingProvider')
  return ctx
}
