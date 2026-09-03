import { describe, expect, it } from 'vitest'
import type { ItemPhoto, QuoteLineItem } from '../../lib/quoteContext'
import { draftForReuse, draftFromItem, emptyItemDraft, findMatchingItem } from './itemDraft'

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
})
