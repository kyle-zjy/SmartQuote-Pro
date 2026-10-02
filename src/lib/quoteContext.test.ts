import { describe, expect, it } from 'vitest'
import { displayQuoteNo } from './displayQuoteNo'
import { getArchivedQuote, upsertArchivedQuote } from './quoteArchive'
import { buildDuplicatedQuote, nextSequenceValue, normalizeQuote, type QuoteLineItem, type QuoteState } from './quoteContext'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }

  clear() {
    this.data.clear()
  }

  getItem(key: string) {
    return this.data.get(key) ?? null
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.data.delete(key)
  }

  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

function sampleItem(overrides: Partial<QuoteLineItem> = {}): QuoteLineItem {
  return {
    id: 'item-1',
    description: 'Door',
    detail: '900 x 2100 mm',
    quantity: 1,
    unitPrice: 610,
    room: 'Lounge',
    note: '',
    ...overrides,
  }
}

function sampleQuote(quoteNo: string, overrides: Partial<QuoteState> = {}): QuoteState {
  return {
    items: [sampleItem()],
    gstEnabled: true,
    roomPhotos: {},
    customer: { name: 'Ada', address: '1 Test St', phone: '0400000000' },
    shipSameAsBill: true,
    shipTo: { name: '', address: '', phone: '' },
    quoteNo,
    quoteNumber: '',
    quoteDate: '2026-08-23',
    frameColour: 'White',
    customFrameColour: '',
    colourExtraOverride: null,
    paid: 0,
    version: 1,
    status: 'draft',
    dealStatus: 'open',
    issuedSnapshot: null,
    ...overrides,
  }
}

describe('quote number round-trip (Issue 2)', () => {
  it('normalizeQuote never pads or otherwise mangles an entered quote number', () => {
    expect(normalizeQuote({ quoteNo: '33098' }).quoteNo).toBe('33098')
  })

  it('displayQuoteNo shows the plain entered number with no zero-padding', () => {
    expect(displayQuoteNo('33098', '')).toBe('33098')
  })

  it('the archive record preserves the exact entered quote number end to end', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('33098'), { total: 610 }, storage)
    const record = getArchivedQuote('33098', undefined, storage)
    expect(record?.quoteNo).toBe('33098')
    expect(record?.quote.quoteNo).toBe('33098')
    expect(displayQuoteNo(record!.quote.quoteNo, record!.quote.quoteNumber)).toBe('33098')
  })

  it('an alphanumeric quote number runss through the archive untouched', () => {
    const storage = new MemoryStorage()
    upsertArchivedQuote(sampleQuote('A123'), { total: 610 }, storage)
    const record = getArchivedQuote('A123', undefined, storage)
    expect(record?.quoteNo).toBe('A123')
    expect(record?.quote.quoteNo).toBe('A123')
    expect(displayQuoteNo(record!.quote.quoteNo, record!.quote.quoteNumber)).toBe('A123')
  })
})

describe('nextSequenceValue (auto-numbering guard for alphanumeric quote numbers)', () => {
  it('advances the sequence when the entered quote number is purely numeric and higher', () => {
    expect(nextSequenceValue(33020, '33098')).toBe(33098)
  })

  it('keeps the current sequence when the entered quote number is purely numeric but lower', () => {
    expect(nextSequenceValue(33020, '100')).toBe(33020)
  })

  it('leaves the sequence untouched for an alphanumeric quote number', () => {
    expect(nextSequenceValue(33020, 'A123')).toBe(33020)
  })

  it('never returns NaN for a non-numeric quote number, which would otherwise corrupt future auto-generated numbers', () => {
    expect(Number.isNaN(nextSequenceValue(33020, 'ABCDEF'))).toBe(false)
  })
})

describe('normalizeQuote price-override backfill (Issue 8)', () => {
  it('backfills calculatedPrice/finalPrice/priceOverridden for a legacy item that never had them', () => {
    const legacy = normalizeQuote({ quoteNo: '1', items: [sampleItem({ unitPrice: 250 })] })
    expect(legacy.items[0]).toMatchObject({
      unitPrice: 250,
      calculatedPrice: 250,
      finalPrice: 250,
      priceOverridden: false,
    })
  })

  it('preserves an existing manual override and its calculatedPrice across a save/reload cycle', () => {
    const overridden = normalizeQuote({
      quoteNo: '1',
      items: [
        sampleItem({
          unitPrice: 650,
          calculatedPrice: 610,
          finalPrice: 650,
          priceOverridden: true,
        }),
      ],
    })
    expect(overridden.items[0]).toMatchObject({
      unitPrice: 650,
      calculatedPrice: 610,
      finalPrice: 650,
      priceOverridden: true,
    })
  })
})

describe('normalizeQuote opening dimensions', () => {
  it('recovers complete multi-panel dimensions saved by the earlier pricing-size wizard', () => {
    const quote = normalizeQuote({ quoteNo: '1', items: [sampleItem({
      configurationCode: 'SDOXXX',
      location: 'Patio',
      openingHeightMm: 2100,
      openingWidthMm: 520,
      measurements: { H1: '2100', W1: '1800' },
      description: 'Patio — Supascreen sliding door — 2100 x 0520 mm',
      detail: '2100 x 520 mm',
    })] })
    expect(quote.items[0]).toMatchObject({
      openingHeightMm: 2100,
      openingWidthMm: 1800,
      description: 'Patio — Supascreen sliding door — 2100 x 1800 mm',
      detail: '2100 × 1800 mm',
    })
  })

  it('keeps main-branch dimensions and manually edited descriptions intact', () => {
    const quote = normalizeQuote({ quoteNo: '1', items: [sampleItem({
      configurationCode: 'SDOXXX',
      openingHeightMm: 2100,
      openingWidthMm: 1800,
      measurements: { H1: '2100', W1: '1800' },
      description: 'Special patio door',
    })] })
    expect(quote.items[0]).toMatchObject({ openingWidthMm: 1800, description: 'Special patio door' })
  })
})

describe('duplicateQuote independence (Issue 7)', () => {
  it('assigns a new quote number and resets lifecycle fields on the duplicate', () => {
    const source = sampleQuote('33098', { version: 3, status: 'issued', paid: 200 })
    const duplicated = buildDuplicatedQuote(source, '33099')
    expect(duplicated.quoteNo).toBe('33099')
    expect(duplicated.version).toBe(1)
    expect(duplicated.status).toBe('draft')
    expect(duplicated.dealStatus).toBe('open')
    expect(duplicated.issuedSnapshot).toBeNull()
    expect(duplicated.paid).toBe(0)
  })

  it('gives every duplicated item a new id, distinct from the source', () => {
    const source = sampleQuote('33098', {
      items: [sampleItem({ id: 'a' }), sampleItem({ id: 'b', description: 'Window' })],
    })
    const duplicated = buildDuplicatedQuote(source, '33099')
    const duplicatedIds = duplicated.items.map((item) => item.id)
    expect(duplicatedIds).toHaveLength(2)
    expect(duplicatedIds).not.toContain('a')
    expect(duplicatedIds).not.toContain('b')
    expect(new Set(duplicatedIds).size).toBe(2)
  })

  it('never shares mutable references with the source -- editing the duplicate cannot touch the original', () => {
    const source = sampleQuote('33098', {
      items: [sampleItem({ id: 'a', description: 'Door' }), sampleItem({ id: 'b', description: 'Window' })],
    })
    const duplicated = buildDuplicatedQuote(source, '33099')

    duplicated.items[0].description = 'Edited in duplicate'
    duplicated.customer.name = 'Edited customer'

    expect(source.items[0].description).toBe('Door')
    expect(source.customer.name).toBe('Ada')
  })

  it('keeps the original archived record unchanged and both quotes independently retrievable after archiving the duplicate', () => {
    const storage = new MemoryStorage()
    const source = sampleQuote('33098', {
      items: [sampleItem({ id: 'a', description: 'Door', unitPrice: 610 }), sampleItem({ id: 'b', description: 'Window', unitPrice: 300 })],
    })
    upsertArchivedQuote(source, { total: 910 }, storage)

    const duplicated = buildDuplicatedQuote(source, '33099')
    duplicated.items[0].description = 'Edited in duplicate'
    upsertArchivedQuote(duplicated, { total: 910 }, storage)

    const original = getArchivedQuote('33098', undefined, storage)
    const copy = getArchivedQuote('33099', undefined, storage)
    expect(original?.quote.items[0].description).toBe('Door')
    expect(copy?.quote.items[0].description).toBe('Edited in duplicate')
    expect(original?.quoteNo).toBe('33098')
    expect(copy?.quoteNo).toBe('33099')
  })
})
