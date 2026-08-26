import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { COMPANY, type CompanySettings } from '../data/company'

const STORAGE_KEY = 'smartquote-pro:company'

function loadSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return COMPANY
    const parsed = JSON.parse(raw) as Partial<CompanySettings>
    return {
      ...COMPANY,
      ...parsed,
      bank: { ...COMPANY.bank, ...parsed.bank },
    }
  } catch {
    return COMPANY
  }
}

interface CompanySettingsValue {
  settings: CompanySettings
  setSettings: (settings: CompanySettings) => void
  resetSettings: () => void
}

const CompanySettingsContext = createContext<CompanySettingsValue | null>(null)

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CompanySettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const value = useMemo<CompanySettingsValue>(
    () => ({
      settings,
      setSettings: setSettingsState,
      resetSettings: () => setSettingsState(COMPANY),
    }),
    [settings],
  )

  return <CompanySettingsContext.Provider value={value}>{children}</CompanySettingsContext.Provider>
}

export function useCompanySettings(): CompanySettingsValue {
  const ctx = useContext(CompanySettingsContext)
  if (!ctx) throw new Error('useCompanySettings must be used within a CompanySettingsProvider')
  return ctx
}
