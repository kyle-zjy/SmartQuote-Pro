import type { QuoteAddon } from '../../lib/quoteContext'
import type { AddonItem } from '../../types/pricing'
import type { ItemDraft } from './itemDraft'

export function addonAvailable(item: AddonItem, draft: Pick<ItemDraft, 'serviceOnly' | 'productKey'>): boolean {
  return (item.section?.trim().toLowerCase() === 'extras') === draft.serviceOnly &&
    !(draft.productKey === 'flyscreens' && item.name === 'TRIPLE LOCKS')
}

/** Preserve captured fitting prices and count a name only once if old data lists it in both places. */
export function draftFittingCharges(draft: ItemDraft, catalog: AddonItem[]): QuoteAddon[] {
  return [...new Set(draft.fitExtras)].filter((name) => !draft.addons.some((addon) => addon.name === name)).map((name) => ({
    name,
    price: draft.fitExtraPrices?.find((extra) => extra.name === name)?.price ?? catalog.find((item) => item.name === name)?.price ?? 0,
  }))
}

export function draftChargesError(draft: ItemDraft, catalog: AddonItem[]): string | null {
  const charges = [...draft.addons, ...draftFittingCharges(draft, catalog)]
  if (charges.some((charge) => !Number.isFinite(charge.price) || charge.price < 0)) return 'Enter a valid price of zero or greater for each selected charge.'
  if (draft.unpricedAddons?.some((name) => charges.some((charge) => charge.name === name))) return 'Enter a price for each selected price-on-request item. Enter 0 explicitly if it is included at no charge.'
  return null
}
