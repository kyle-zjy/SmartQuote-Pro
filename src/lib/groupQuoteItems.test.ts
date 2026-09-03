import { describe, expect, it } from 'vitest'
import { groupQuoteItemsByLocation } from './groupQuoteItems'
import type { QuoteLineItem } from './quoteContext'

function item(patch: Partial<QuoteLineItem>): QuoteLineItem {
  return {
    id: patch.id ?? Math.random().toString(36).slice(2),
    description: '',
    detail: '',
    quantity: 1,
    unitPrice: 100,
    room: '',
    note: '',
    ...patch,
  }
}

describe('groupQuoteItemsByLocation', () => {
  it('groups items by exact same location, preserving first-appearance order', () => {
    const items = [
      item({ location: 'Living Room' }),
      item({ location: 'Living Room' }),
      item({ location: 'Kitchen' }),
    ]

    const groups = groupQuoteItemsByLocation(items)

    expect(groups).toHaveLength(2)
    expect(groups[0].location).toBe('Living Room')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].location).toBe('Kitchen')
    expect(groups[1].items).toHaveLength(1)
  })

  it('never merges numbered bedrooms into one group', () => {
    const items = [
      item({ location: 'Bedroom 1' }),
      item({ location: 'Bedroom 2' }),
      item({ location: 'Bedroom 1' }),
    ]

    const groups = groupQuoteItemsByLocation(items)

    expect(groups).toHaveLength(2)
    expect(groups[0].location).toBe('Bedroom 1')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].location).toBe('Bedroom 2')
    expect(groups[1].items).toHaveLength(1)
  })

  it('normalizes accidental whitespace/casing but keeps the first-seen label', () => {
    const items = [item({ location: 'Bedroom 1' }), item({ location: ' bedroom 1 ' })]

    const groups = groupQuoteItemsByLocation(items)

    expect(groups).toHaveLength(1)
    expect(groups[0].location).toBe('Bedroom 1')
    expect(groups[0].items).toHaveLength(2)
  })

  it('keeps rooms in the order they first appear, not alphabetical', () => {
    const items = [
      item({ location: 'Living Room' }),
      item({ location: 'Bedroom 1' }),
      item({ location: 'Kitchen' }),
      item({ location: 'Bedroom 2' }),
    ]

    expect(groupQuoteItemsByLocation(items).map((g) => g.location)).toEqual([
      'Living Room',
      'Bedroom 1',
      'Kitchen',
      'Bedroom 2',
    ])
  })

  it('computes a presentation-only subtotal per room without touching item data', () => {
    const items = [
      item({ location: 'Living Room', unitPrice: 100, quantity: 2 }),
      item({ location: 'Living Room', unitPrice: 50, quantity: 1 }),
    ]

    const groups = groupQuoteItemsByLocation(items)
    expect(groups[0].subtotal).toBe(250)
  })

  it('falls back to legacy room field and groups blank locations as Unassigned', () => {
    const items = [item({ location: undefined, room: 'Study' }), item({ location: undefined, room: '' })]

    const groups = groupQuoteItemsByLocation(items)
    expect(groups[0].location).toBe('Study')
    expect(groups[1].location).toBe('Unassigned')
  })
})
