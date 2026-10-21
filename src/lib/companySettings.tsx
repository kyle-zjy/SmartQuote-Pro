import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { COMPANY, type CompanySettings } from '../data/company'
import {
  COMPANY_SETTINGS_KEY,
  readCompanySettings,
  saveCompanySettings,
  validateCompanySettings,
} from './companySettingsStore'
import { SERVER_DATA_EVENT, SERVER_MODE } from './apiClient'
import { sharedRecordRevision, saveSharedSetting } from './serverWorkspace'
import { withQuoteStorageLock } from './quoteWriteLock'

interface CompanySettingsValue {
  settings: CompanySettings
  setSettings: (settings: CompanySettings) => Promise<string | null>
  resetSettings: () => Promise<string | null>
  reloadSettings: () => CompanySettings
}

const CompanySettingsContext = createContext<CompanySettingsValue | null>(null)

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CompanySettings>(readCompanySettings)
  const reloadSettings = useCallback(() => {
    const latest = readCompanySettings()
    setSettingsState(latest)
    return latest
  }, [])

  useEffect(() => {
    const refresh = () => {
      reloadSettings()
    }
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === COMPANY_SETTINGS_KEY) refresh()
    }
    window.addEventListener('storage', changed)
    window.addEventListener('focus', refresh)
    window.addEventListener(SERVER_DATA_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(SERVER_DATA_EVENT, refresh)
    }
  }, [reloadSettings])

  const setSettings = useCallback(async (next: CompanySettings) => {
    try {
      const invalid = validateCompanySettings(next)
      if (invalid) return invalid
      if (SERVER_MODE) await saveSharedSetting('company', next, sharedRecordRevision('company'))
      else
        await withQuoteStorageLock(() => {
          const error = saveCompanySettings(next)
          if (error) throw new Error(error)
        })
      setSettingsState(next)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not save company settings.'
    }
  }, [])

  const value = useMemo<CompanySettingsValue>(
    () => ({
      settings,
      setSettings,
      resetSettings: () => setSettings(COMPANY),
      reloadSettings,
    }),
    [settings, setSettings, reloadSettings],
  )

  return <CompanySettingsContext.Provider value={value}>{children}</CompanySettingsContext.Provider>
}

export function useCompanySettings(): CompanySettingsValue {
  const ctx = useContext(CompanySettingsContext)
  if (!ctx) throw new Error('useCompanySettings must be used within a CompanySettingsProvider')
  return ctx
}
