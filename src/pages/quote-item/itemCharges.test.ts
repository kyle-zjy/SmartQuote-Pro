import { describe, expect, it } from 'vitest'
import type { AddonItem } from '../../types/pricing'
import { addonAvailable, draftChargesError, draftFittingCharges } from './itemCharges'
import { emptyItemDraft, findMatchingItem } from './itemDraft'

const catalog: AddonItem[] = [
  { name: 'TRIPLE LOCKS', section: 'Door hardware', price: 120, priceOnRequest: false, unit: null },
  { name: 'CALL OUT FEE', section: 'Extras', price: 95, priceOnRequest: false, unit: null },
]

describe('selected item charges', () => {
  it('separates repair extras and product add-ons, including flyscreen restrictions', () => {
    expect(addonAvailable(catalog[0], { serviceOnly: false, productKey: 'supascreen' })).toBe(true)
    expect(addonAvailable(catalog[1], { serviceOnly: false, productKey: 'supascreen' })).toBe(false)
    expect(addonAvailable(catalog[0], { serviceOnly: false, productKey: 'flyscreens' })).toBe(false)
    expect(addonAvailable(catalog[1], { serviceOnly: true, productKey: '' })).toBe(true)
    expect(addonAvailable(catalog[0], { serviceOnly: true, productKey: '' })).toBe(false)
  })

  it('uses captured fitting prices and avoids charging twice for duplicate legacy selections', () => {
    const draft = { ...emptyItemDraft(), fitExtras: ['TRIPLE LOCKS', 'TRIPLE LOCKS'], fitExtraPrices: [{ name: 'TRIPLE LOCKS', price: 75 }] }
    expect(draftFittingCharges(draft, catalog)).toEqual([{ name: 'TRIPLE LOCKS', price: 75 }])
    draft.addons = [{ name: 'TRIPLE LOCKS', price: 80 }]
    expect(draftFittingCharges(draft, catalog)).toEqual([])
  })

  it('requires an explicit price and rejects negative or invalid fees', () => {
    const draft = { ...emptyItemDraft(), addons: [{ name: 'CUSTOM', price: 0 }], unpricedAddons: ['CUSTOM'] }
    expect(draftChargesError(draft, catalog)).toMatch(/Enter a price/)
    expect(draftChargesError({ ...draft, unpricedAddons: [] }, catalog)).toBeNull()
    for (const price of [-1, NaN, Infinity]) expect(draftChargesError({ ...draft, addons: [{ name: 'CUSTOM', price }] }, catalog)).toMatch(/valid price/)
  })

  it('does not merge openings with different measurements, window or fitting options at the same price', () => {
    const original = { id: 'item', unitPrice: 100, measurements: { H1: '2100', H2: '2098' }, fitExtras: ['TOP TRACKS'] }
    expect(findMatchingItem([original], { ...original, measurements: { H1: '2100', H2: '2097' } })).toBeUndefined()
    expect(findMatchingItem([original], { ...original, fitExtras: ['BOTTOM TRACK'] })).toBeUndefined()
    expect(findMatchingItem([original], { ...original, doubleHung: true })).toBeUndefined()
    expect(findMatchingItem([original], { ...original, measurements: { H2: '2098', H1: '2100' } })?.id).toBe('item')
  })
})
