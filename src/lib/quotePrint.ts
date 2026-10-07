import addonCatalog from '../data/addons.json'
import { itemPrice, money } from './quoteTotals'
import { padMm } from './lineDescription'
import { pricingBracketForItem } from './quoteSheet'
import type { QuoteAddon, QuoteLineItem } from './quoteContext'
import type { PricingData } from '../types/pricing'

export type QuoteAudience = 'customer' | 'factory'

// Replace with Goldco's approved wording when supplied.
export const PET_DOOR_DISCLAIMER = 'Adding a pet door means this door is no longer considered a security door.'

export function petDoorOptions(item: Pick<QuoteLineItem, 'addons' | 'fitExtras'>): string[] {
  const names = [...(item.addons ?? []).map((addon) => addon.name), ...(item.fitExtras ?? [])]
  return [...new Set(names.filter((name) => /\bpet\s*door\b/i.test(name)).map((name) => {
    const size = name.match(/^pet\s*door\s*-\s*(small|medium|large)$/i)?.[1]
    return size ? `${size[0].toUpperCase()}${size.slice(1).toLowerCase()} Pet Door` : name
  }))]
}

export function extraLabel(name: string): string {
  const size = name.match(/^pet\s*door\s*-\s*(small|medium|large)$/i)?.[1]
  return size ? `${size[0].toUpperCase()}${size.slice(1).toLowerCase()} Pet Door` : name
}

export function quoteExtras(item: QuoteLineItem): QuoteAddon[] {
  const extras = [...(item.addons ?? [])]
  for (const name of item.fitExtras ?? []) {
    if (!extras.some((extra) => extra.name === name)) {
      // Older quotes did not capture fitting-extra prices; use the original bundled price list.
      const price = item.fitExtraPrices?.find((extra) => extra.name === name)?.price
        ?? addonCatalog.find((extra) => extra.name === name)?.price ?? 0
      extras.push({ name, price })
    }
  }
  return extras
}

export function productPrice(item: QuoteLineItem): number {
  return money(itemPrice(item) - quoteExtras(item).reduce((sum, extra) => sum + extra.price, 0))
}

export function removeQuoteExtra(item: QuoteLineItem, name: string): Partial<QuoteLineItem> {
  const extra = quoteExtras(item).find((candidate) => candidate.name === name)
  if (!extra) return {}
  const finalPrice = money(itemPrice(item) - extra.price)
  return {
    ...(item.customerNote === PET_DOOR_DISCLAIMER && petDoorOptions({ addons: item.addons?.filter((candidate) => candidate.name !== name), fitExtras: item.fitExtras?.filter((candidate) => candidate !== name) }).length === 0 ? { customerNote: '' } : {}),
    addons: item.addons?.filter((candidate) => candidate.name !== name),
    fitExtras: item.fitExtras?.filter((candidate) => candidate !== name),
    fitExtraPrices: item.fitExtraPrices?.filter((candidate) => candidate.name !== name),
    unitPrice: finalPrice,
    finalPrice,
    calculatedPrice: money((item.calculatedPrice ?? item.unitPrice) - extra.price),
  }
}

export function customerQuoteNote(item: Pick<QuoteLineItem, 'customerNote' | 'addons' | 'fitExtras'>): string {
  // An explicitly empty note must stay empty; fallback only for older/unedited items.
  return item.customerNote ?? (petDoorOptions(item).length > 0 ? PET_DOOR_DISCLAIMER : '')
}

/**
 * The customer-facing quote must show the price-matrix bracket the item was billed at, not the
 * precise site measurement -- this keeps the exact measurement from reaching the customer while
 * still telling them accurately what they're paying for. The factory copy keeps the real
 * measurement so production builds to what was actually measured.
 */
export function displayDescription(item: QuoteLineItem, audience: QuoteAudience, pricingData: PricingData): string {
  if (audience !== 'customer' || item.openingWidthMm == null || item.openingHeightMm == null) return item.description
  const bracket = pricingBracketForItem(item, pricingData)
  if (!bracket) return item.description
  const actualSuffix = `${padMm(item.openingHeightMm)} x ${padMm(item.openingWidthMm)} mm`
  if (!item.description.endsWith(actualSuffix)) return item.description
  const bracketSuffix = `${padMm(bracket.heightMm)} x ${padMm(bracket.widthMm)} mm`
  return `${item.description.slice(0, -actualSuffix.length)}${bracketSuffix}`
}
