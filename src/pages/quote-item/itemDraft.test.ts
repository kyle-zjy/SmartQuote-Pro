import { describe, expect, it } from 'vitest'
import { calcConfiguredPrice } from '../../lib/configuredPrice'
import type { ItemPhoto, QuoteLineItem } from '../../lib/quoteContext'
import type { Product } from '../../types/pricing'
import { draftForReuse, draftFromItem, emptyItemDraft, findMatchingItem } from './itemDraft'

function testProducts(): Product[] {
  return [
    {
      key: 'supascreen',
      name: 'Supascreen',
      pricingAsAt: null,
      categories: [
        {
          key: 'windows',
          label: 'Windows',
          widths: [900, 1200],
          heights: [900, 1200],
          prices: [
            [100, 120],
            [140, 160],
          ],
          extras: null,
        },
        {
          key: 'doors',
          label: 'Doors',
          widths: [900, 1200],
          heights: [2100, 2400],
          prices: [
            [500, 520],
            [540, 560],
          ],
          extras: null,
        },
      ],
    },
    {
      key: 'flyscreens',
      name: 'Fly Screens',
      pricingAsAt: null,
      categories: [
        {
          key: 'windows',
          label: 'Windows',
          widths: [900, 1200],
          heights: [900, 1200],
          prices: [
            [80, 90],
            [95, 105],
          ],
          extras: null,
        },
        {
          key: 'sliding-doors',
          label: 'Sliding Doors',
          widths: [900, 1200],
          heights: [2100, 2400],
          prices: [
            [300, 320],
            [340, 360],
          ],
          extras: null,
        },
        {
          key: 'hinged-doors',
          label: 'Hinged Doors',
          widths: [900, 1200],
          heights: [2100, 2400],
          prices: [
            [250, 270],
            [290, 310],
          ],
          extras: null,
        },
      ],
    },
  ]
}

function samplePhoto(id = 'photo-1'): ItemPhoto {
  return { id, dataUrl: 'data:image/jpeg;base64,AAA', strokes: [], annotatedDataUrl: null }
}

function sampleItem(overrides: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: 'item-1',
    description: 'Window',
    detail: '900 x 1200 mm',
    quantity: 1,
    unitPrice: 250,
    room: 'Lounge',
    note: '',
    productKey: 'flyscreens',
    location: 'Lounge',
    configurationCode: 'W1',
    ...overrides,
  }
}

describe('itemDraft photos', () => {
  it('starts with no photos on a brand-new draft', () => {
    expect(emptyItemDraft().photos).toEqual([])
  })

  it('carries photos over when building a draft from an existing item', () => {
    const item = sampleItem({ photos: [samplePhoto()] })
    expect(draftFromItem(item).photos).toEqual([samplePhoto()])
  })

  it('defaults to no photos when the source item has none', () => {
    expect(draftFromItem(sampleItem()).photos).toEqual([])
  })

  it('clears photos when reusing an item for a new opening', () => {
    const item = sampleItem({ photos: [samplePhoto()] })
    expect(draftForReuse(item).photos).toEqual([])
  })

  it('does not merge quantity into an existing item that has different photos', () => {
    const existing = sampleItem({ photos: [samplePhoto('a')] })
    const candidate = { ...existing, photos: [samplePhoto('b')] }
    expect(findMatchingItem([existing], candidate)).toBeUndefined()
  })

  it('merges quantity into an existing item with the same photos', () => {
    const existing = sampleItem({ photos: [samplePhoto('a')] })
    const candidate = { ...existing, photos: [samplePhoto('a')] }
    expect(findMatchingItem([existing], candidate)?.id).toBe(existing.id)
  })

  it('merges quantity when neither item has any photos', () => {
    const existing = sampleItem()
    const candidate = { ...existing }
    expect(findMatchingItem([existing], candidate)?.id).toBe(existing.id)
  })

  it('keeps openings with different lock details or bowed condition separate', () => {
    const existing = sampleItem({ lockHeightMm: 950, lockSide: 'left', centreTongue: true, bowed: false })
    expect(findMatchingItem([existing], { ...existing, bowed: true })).toBeUndefined()
    expect(findMatchingItem([existing], { ...existing, lockHeightMm: 1000 })).toBeUndefined()
    expect(draftFromItem(existing)).toMatchObject({
      lockHeightMm: '950', lockSide: 'left', centreTongue: true, bowed: false,
    })
  })
})

describe('itemDraft category/doubleHung/fitExtras round-trip', () => {
  it('preserves categoryKey, doubleHung and fitExtras when editing a saved door item', () => {
    const item = sampleItem({
      productKey: 'supascreen',
      categoryKey: 'doors',
      configurationCode: 'SDOXX',
      doubleHung: true,
      fitExtras: ['Fit only'],
    })
    const draft = draftFromItem(item, testProducts())
    expect(draft.categoryKey).toBe('doors')
    expect(draft.doubleHung).toBe(true)
    expect(draft.fitExtras).toEqual(['Fit only'])
  })

  it('falls back to matching the configuration family for a legacy item with no stored categoryKey', () => {
    const item = sampleItem({
      productKey: 'supascreen',
      categoryKey: undefined,
      configurationCode: 'SDOXX',
    })
    expect(draftFromItem(item, testProducts()).categoryKey).toBe('doors')
  })

  it('never silently swaps a Fly Screen item onto the Door or Window product', () => {
    const item = sampleItem({
      productKey: 'flyscreens',
      categoryKey: 'hinged-doors',
      configurationCode: 'HDOXX',
    })
    const draft = draftFromItem(item, testProducts())
    expect(draft.productKey).toBe('flyscreens')
    expect(draft.categoryKey).toBe('hinged-doors')
  })
})

describe('Door vs Window pricing never cross-uses the wrong table', () => {
  it('prices an identical width/height differently for Door vs Window categories', () => {
    const [supascreen] = testProducts()
    const windowCategory = supascreen.categories.find((c) => c.key === 'windows')!
    const doorCategory = supascreen.categories.find((c) => c.key === 'doors')!

    const windowPrice = calcConfiguredPrice(windowCategory, 900, 900).unitPrice
    const doorPrice = calcConfiguredPrice(doorCategory, 900, 900).unitPrice

    expect(windowPrice).toBe(100)
    expect(doorPrice).toBe(500)
    expect(windowPrice).not.toBe(doorPrice)
  })

  it('prices Fly Screen sliding-door and hinged-door categories independently of each other and of windows', () => {
    const [, flyscreens] = testProducts()
    const windowCategory = flyscreens.categories.find((c) => c.key === 'windows')!
    const slidingCategory = flyscreens.categories.find((c) => c.key === 'sliding-doors')!
    const hingedCategory = flyscreens.categories.find((c) => c.key === 'hinged-doors')!

    const windowPrice = calcConfiguredPrice(windowCategory, 900, 900).unitPrice
    const slidingPrice = calcConfiguredPrice(slidingCategory, 900, 2100).unitPrice
    const hingedPrice = calcConfiguredPrice(hingedCategory, 900, 2100).unitPrice

    expect(windowPrice).toBe(80)
    expect(slidingPrice).toBe(300)
    expect(hingedPrice).toBe(250)
    expect(new Set([windowPrice, slidingPrice, hingedPrice]).size).toBe(3)
  })
})
