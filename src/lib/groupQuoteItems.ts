import { normalizeLocationKey } from './roomTypes'
import type { QuoteLineItem } from './quoteContext'

export interface QuoteRoomGroup {
  /** User-facing room label, taken from the first item that used it. */
  location: string
  items: QuoteLineItem[]
  /** Presentation-only helper total (unit price x quantity summed). Never used for quote pricing. */
  subtotal: number
}

function itemLocation(item: QuoteLineItem): string {
  return (item.location ?? item.room ?? '').trim()
}

/**
 * Groups quote items by their location/room for display. Items whose normalized location
 * matches (trim/case-insensitive only -- room numbers are never stripped) are grouped
 * together under the label of the first item that used it. Groups and the items within them
 * keep the quote's existing order (first-appearance order), not alphabetical order.
 *
 * Presentation only: does not mutate items or affect quote pricing.
 */
export function groupQuoteItemsByLocation(items: QuoteLineItem[]): QuoteRoomGroup[] {
  const groups: QuoteRoomGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const item of items) {
    const label = itemLocation(item) || 'Unassigned'
    const key = normalizeLocationKey(label)
    let index = indexByKey.get(key)
    if (index === undefined) {
      index = groups.length
      indexByKey.set(key, index)
      groups.push({ location: label, items: [], subtotal: 0 })
    }
    const group = groups[index]
    group.items.push(item)
    group.subtotal += item.unitPrice * item.quantity
  }

  return groups
}
