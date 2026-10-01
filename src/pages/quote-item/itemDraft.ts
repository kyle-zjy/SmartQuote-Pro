import { STANDARD_MESH } from '../../lib/configuredPrice'
import type { ItemPhoto, QuoteAddon, QuoteLineItem } from '../../lib/quoteContext'
import { configFamily } from '../../lib/quoteSheet'
import type { PriceCategory, Product } from '../../types/pricing'

/**
 * Local, wizard-only shape for the opening being built. Diagram markers/strokes are
 * deliberately NOT part of this draft -- they stay ephemeral in ItemWizard's own state
 * and are never persisted onto a QuoteLineItem.
 */
export interface ItemDraft {
  location: string
  configurationCode: string
  measurements: Record<string, string>
  lockHeightMm: string
  lockSide: 'left' | 'right' | ''
  centreTongue: boolean
  lockTopMm: string
  lockCentreMm: string
  lockBottomMm: string
  midRailRequired: boolean
  midRailHeightMm: string
  interlockAdjustment: 'add' | 'remove' | ''
  bowed: boolean
  serviceOnly: boolean
  serviceDescription: string
  servicePrice: string
  productKey: string
  categoryKey: string
  widthMm: string
  heightMm: string
  meshOption: string
  doubleHung: boolean
  fitExtras: string[]
  frameColourMode: 'default' | 'custom'
  customFrameColour: string
  addons: QuoteAddon[]
  note: string
  quantity: number
  photos: ItemPhoto[]
}

export function emptyItemDraft(): ItemDraft {
  return {
    location: '',
    configurationCode: '',
    measurements: {},
    lockHeightMm: '',
    lockSide: '',
    centreTongue: false,
    lockTopMm: '',
    lockCentreMm: '',
    lockBottomMm: '',
    midRailRequired: false,
    midRailHeightMm: '',
    interlockAdjustment: '',
    bowed: false,
    serviceOnly: false,
    serviceDescription: '',
    servicePrice: '',
    productKey: '',
    categoryKey: '',
    widthMm: '',
    heightMm: '',
    meshOption: STANDARD_MESH,
    doubleHung: false,
    fitExtras: [],
    frameColourMode: 'default',
    customFrameColour: '',
    addons: [],
    note: '',
    quantity: 1,
    photos: [],
  }
}

function preferredCategoryKeys(configurationCode: string): string[] {
  const family = configurationCode ? configFamily(configurationCode) : 'other'
  return family === 'window'
    ? ['windows']
    : family === 'hinged'
      ? ['hinged-doors', 'doors']
      : family === 'sliding'
        ? ['sliding-doors', 'doors']
        : []
}

/** Returns only the price categories that match the opening configuration, in most-specific-first order. */
export function compatibleCategories(product: Product, configurationCode: string): PriceCategory[] {
  const preferredKeys = preferredCategoryKeys(configurationCode)
  if (preferredKeys.length === 0) return product.categories
  return preferredKeys.flatMap((key) => {
    const category = product.categories.find((candidate) => candidate.key === key)
    return category ? [category] : []
  })
}

/**
 * Best-effort category resolution for a saved item. Prefers the persisted categoryKey; falls back to
 * matching the item's configuration family (door/sliding/window) against the recorded product's own
 * categories, for legacy items saved before categoryKey was persisted. Leaves it blank only if nothing
 * can be resolved -- ProductStep's own fallback + write-back then takes over from there.
 */
function resolveCategoryKey(item: QuoteLineItem, products: Product[]): string {
  if (products.length === 0) return item.categoryKey ?? ''
  const product = products.find((p) => p.key === item.productKey)
  if (!product) return item.categoryKey ?? ''
  const categories = compatibleCategories(product, item.configurationCode ?? '')
  if (item.categoryKey && categories.some((category) => category.key === item.categoryKey)) return item.categoryKey
  return categories[0]?.key ?? ''
}

/** Builds a draft from an existing item, for Edit or Duplicate. */
export function draftFromItem(item: QuoteLineItem, products: Product[] = []): ItemDraft {
  return {
    location: item.location ?? item.room ?? '',
    configurationCode: item.configurationCode ?? '',
    measurements: item.measurements ?? {},
    lockHeightMm: item.lockHeightMm == null ? '' : String(item.lockHeightMm),
    lockSide: item.lockSide ?? '',
    centreTongue: item.centreTongue ?? false,
    lockTopMm: item.lockTopMm == null ? '' : String(item.lockTopMm),
    lockCentreMm: item.lockCentreMm == null ? '' : String(item.lockCentreMm),
    lockBottomMm: item.lockBottomMm == null ? '' : String(item.lockBottomMm),
    midRailRequired: item.midRailRequired ?? false,
    midRailHeightMm: item.midRailHeightMm == null ? '' : String(item.midRailHeightMm),
    interlockAdjustment: item.interlockAdjustment ?? '',
    bowed: item.bowed ?? false,
    serviceOnly: item.serviceOnly ?? !item.productKey,
    serviceDescription: item.serviceDescription ?? (!item.productKey ? item.description : ''),
    servicePrice: item.servicePrice == null ? (!item.productKey ? String(item.unitPrice) : '') : String(item.servicePrice),
    productKey: item.productKey ?? '',
    categoryKey: resolveCategoryKey(item, products),
    widthMm: item.openingWidthMm ? String(item.openingWidthMm) : '',
    heightMm: item.openingHeightMm ? String(item.openingHeightMm) : '',
    meshOption: item.material ?? STANDARD_MESH,
    doubleHung: item.doubleHung ?? false,
    fitExtras: item.fitExtras ?? [],
    frameColourMode: item.frameColourMode ?? 'default',
    customFrameColour: item.customFrameColour ?? '',
    addons: item.addons ?? [],
    note: item.note ?? '',
    quantity: item.quantity,
    photos: item.photos ?? [],
  }
}

/**
 * Reuse must always force a fresh location confirmation, so it never silently reuses the original.
 * Reference photos are tied to the original opening, so they don't carry over either.
 */
export function draftForReuse(item: QuoteLineItem, products: Product[] = []): ItemDraft {
  return { ...draftFromItem(item, products), location: '', photos: [] }
}

interface ComparableItem {
  location?: string
  configurationCode?: string
  productKey?: string
  openingWidthMm?: number
  openingHeightMm?: number
  lockHeightMm?: number | null
  lockSide?: 'left' | 'right' | ''
  centreTongue?: boolean
  lockTopMm?: number | null
  lockCentreMm?: number | null
  lockBottomMm?: number | null
  midRailRequired?: boolean
  midRailHeightMm?: number | null
  interlockAdjustment?: 'add' | 'remove' | ''
  bowed?: boolean
  serviceOnly?: boolean
  serviceDescription?: string
  servicePrice?: number
  material?: string
  frameColourMode?: 'default' | 'custom'
  customFrameColour?: string
  note?: string
  addons?: QuoteAddon[]
  photos?: ItemPhoto[]
  unitPrice: number
}

function itemSignature(item: ComparableItem): string {
  return JSON.stringify({
    location: item.location ?? '',
    configurationCode: item.configurationCode ?? '',
    productKey: item.productKey ?? '',
    openingWidthMm: item.openingWidthMm ?? null,
    openingHeightMm: item.openingHeightMm ?? null,
    lockHeightMm: item.lockHeightMm ?? null,
    lockSide: item.lockSide ?? '',
    centreTongue: item.centreTongue ?? false,
    lockTopMm: item.lockTopMm ?? null,
    lockCentreMm: item.lockCentreMm ?? null,
    lockBottomMm: item.lockBottomMm ?? null,
    midRailRequired: item.midRailRequired ?? false,
    midRailHeightMm: item.midRailHeightMm ?? null,
    interlockAdjustment: item.interlockAdjustment ?? '',
    bowed: item.bowed ?? false,
    serviceOnly: item.serviceOnly ?? false,
    serviceDescription: item.serviceDescription ?? '',
    servicePrice: item.servicePrice ?? 0,
    material: item.material ?? '',
    frameColourMode: item.frameColourMode ?? 'default',
    customFrameColour: item.customFrameColour ?? '',
    note: item.note ?? '',
    addons: [...(item.addons ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    // Different photos mean a genuinely different opening context, even if every other field matches
    // -- never silently merge quantity and drop one item's photos in the process.
    photos: item.photos ?? [],
    unitPrice: item.unitPrice,
  })
}

/** Finds an existing item that is identical in every respect but quantity, so a new save can bump quantity instead of duplicating a row. */
export function findMatchingItem<T extends ComparableItem & { id: string }>(
  items: T[],
  candidate: ComparableItem,
): T | undefined {
  const signature = itemSignature(candidate)
  return items.find((item) => itemSignature(item) === signature)
}

/** Picks the first product/category combination that is compatible with the opening configuration. */
export function defaultProductSelection(
  configurationCode: string,
  products: Product[],
): { productKey: string; categoryKey: string } | null {
  for (const product of products) {
    const category = compatibleCategories(product, configurationCode)[0]
    if (category) return { productKey: product.key, categoryKey: category.key }
  }

  return null
}
