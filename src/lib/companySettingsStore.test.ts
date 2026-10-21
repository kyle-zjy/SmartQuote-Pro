import { describe, expect, it } from 'vitest'
import { COMPANY } from '../data/company'
import { MemoryStorage } from '../test/memoryStorage'
import { COMPANY_SETTINGS_KEY, readCompanySettings, saveCompanySettings } from './companySettingsStore'

describe('company settings persistence', () => {
  it('rejects invalid money, rates and validity before overwriting saved settings', () => {
    const storage = new MemoryStorage()
    expect(saveCompanySettings(COMPANY, storage)).toBeNull()
    const before = storage.getItem(COMPANY_SETTINGS_KEY)
    for (const patch of [{ depositRate: 1.1 }, { depositRate: NaN }, { validityDays: 0 }, { validityDays: 1.5 }, { cardFeePercent: -1 }, { nonStandardColourPrice: -10 }, { name: ' ' }]) {
      expect(saveCompanySettings({ ...COMPANY, ...patch }, storage)).toBeTypeOf('string')
      expect(storage.getItem(COMPANY_SETTINGS_KEY)).toBe(before)
    }
  })

  it('reports a failed write and retains the previous saved values', () => {
    const storage = new MemoryStorage()
    saveCompanySettings(COMPANY, storage)
    storage.failWrites = true
    expect(saveCompanySettings({ ...COMPANY, name: 'Unsaved edits' }, storage)).toMatch(/Could not save/)
    expect(readCompanySettings(storage).name).toBe(COMPANY.name)
  })

  it('recovers malformed values without losing unrelated valid company details', () => {
    const storage = new MemoryStorage()
    storage.setItem(COMPANY_SETTINGS_KEY, JSON.stringify({ name: 'Test Screens', depositRate: 50, validityDays: -1, nonStandardColourPrice: null, bank: { name: 'Test Bank', account: 123 } }))
    expect(readCompanySettings(storage)).toMatchObject({ name: 'Test Screens', depositRate: 0.5, validityDays: 30, nonStandardColourPrice: 220, bank: { name: 'Test Bank', account: COMPANY.bank.account } })
    storage.setItem(COMPANY_SETTINGS_KEY, 'null')
    expect(readCompanySettings(storage)).toEqual(COMPANY)
  })
})
