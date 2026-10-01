import addonCatalog from '../data/addons.json'
import { itemPrice, money } from './quoteTotals'
import type { QuoteAddon, QuoteLineItem } from './quoteContext'

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
