import { workspaceStorage } from './workspaceStorage'
import { COMPANY, type CompanySettings } from '../data/company'

export const COMPANY_SETTINGS_KEY = 'smartquote-pro:company'

export function validateCompanySettings(settings: CompanySettings): string | null {
  if (!settings.name.trim()) return 'Enter a company name.'
  if (!Number.isFinite(settings.depositRate) || settings.depositRate < 0 || settings.depositRate > 1) {
    return 'Deposit rate must be between 0 and 1.'
  }
  if (!Number.isSafeInteger(settings.validityDays) || settings.validityDays < 1) return 'Validity must be a whole number of at least 1 day.'
  if (!Number.isFinite(settings.cardFeePercent) || settings.cardFeePercent < 0 || settings.cardFeePercent > 100) {
    return 'Card fee must be between 0 and 100 percent.'
  }
  if (!Number.isFinite(settings.nonStandardColourPrice) || settings.nonStandardColourPrice < 0) {
    return 'Non-standard colour price must be zero or greater.'
  }
  return null
}

export function readCompanySettings(storage?: Storage): CompanySettings {
  try {
    const parsed: unknown = JSON.parse((storage ?? workspaceStorage).getItem(COMPANY_SETTINGS_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return COMPANY
    const values = parsed as Record<string, unknown>
    const next = { ...COMPANY, bank: { ...COMPANY.bank } }
    for (const key of Object.keys(COMPANY) as Array<keyof CompanySettings>) {
      if (key === 'bank') continue
      const value = values[key]
      if (typeof value === typeof COMPANY[key]) Object.assign(next, { [key]: value })
    }
    if (values.bank && typeof values.bank === 'object' && !Array.isArray(values.bank)) {
      for (const key of ['name', 'bsb', 'account'] as const) {
        const value = (values.bank as Record<string, unknown>)[key]
        if (typeof value === 'string') next.bank[key] = value
      }
    }
    // Retain valid fields even if an older browser saved an invalid numeric default.
    if (!next.name.trim()) next.name = COMPANY.name
    if (!Number.isFinite(next.depositRate) || next.depositRate < 0 || next.depositRate > 1) next.depositRate = COMPANY.depositRate
    if (!Number.isSafeInteger(next.validityDays) || next.validityDays < 1) next.validityDays = COMPANY.validityDays
    if (!Number.isFinite(next.cardFeePercent) || next.cardFeePercent < 0 || next.cardFeePercent > 100) next.cardFeePercent = COMPANY.cardFeePercent
    if (!Number.isFinite(next.nonStandardColourPrice) || next.nonStandardColourPrice < 0) next.nonStandardColourPrice = COMPANY.nonStandardColourPrice
    return next
  } catch {
    return COMPANY
  }
}

export function saveCompanySettings(settings: CompanySettings, storage?: Storage): string | null {
  const error = validateCompanySettings(settings)
  if (error) return error
  try {
    (storage ?? workspaceStorage).setItem(COMPANY_SETTINGS_KEY, JSON.stringify(settings))
    return null
  } catch {
    return 'Could not save company settings. Your changes are still here. Check browser storage and try again.'
  }
}
