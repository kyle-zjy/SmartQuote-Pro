import { STANDARD_MESH } from '../../lib/configuredPrice'
import type { ItemPhoto, QuoteAddon, QuoteLineItem } from '../../lib/quoteContext'
import { configFamily } from '../../lib/quoteSheet'
import type { Product } from '../../types/pricing'

/**
 * Local, wizard-only shape for the opening being built. Diagram markers/strokes are
 * deliberately NOT part of this draft -- they stay ephemeral in ItemWizard's own state
 * and are never persisted onto a QuoteLineItem.
 */
export interface ItemDraft {
  location: string
  configurationCode: string
  measurements: Record<string, string>
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

/** Builds a draft from an existing item, for Edit or Duplicate. */
export function draftFromItem(item: QuoteLineItem): ItemDraft {
  return {
    location: item.location ?? item.room ?? '',
    configurationCode: item.configurationCode ?? '',
    measurements: item.measurements ?? {},
    productKey: item.productKey ?? '',
    categoryKey: '',
    widthMm: item.openingWidthMm ? String(item.openingWidthMm) : '',
    heightMm: item.openingHeightMm ? String(item.openingHeightMm) : '',
    meshOption: item.material ?? STANDARD_MESH,
    doubleHung: false,
    fitExtras: [],
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
export function draftForReuse(item: QuoteLineItem): ItemDraft {
  return { ...draftFromItem(item), location: '', photos: [] }
}

interface ComparableItem {
  location?: string
  configurationCode?: string
  productKey?: string
  openingWidthMm?: number
  openingHeightMm?: number
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

/**
 * Picks a starting product/category tab for a brand-new draft, based only on the configuration's
 * door/window/sliding/hinged family (already-derived vocabulary from configFamily). This is a UX
 * default only -- no product/opening compatibility rule exists, so ProductStep still lets staff
 * switch to any product/category regardless of this pick.
 */
export function defaultProductSelection(
  configurationCode: string,
  products: Product[],
): { productKey: string; categoryKey: string } | null {
  const first = products[0]
  if (!first) return null

  const family = configurationCode ? configFamily(configurationCode) : 'other'
  const preferredCategoryKeys =
    family === 'window'
      ? ['windows']
      : family === 'hinged'
        ? ['hinged-doors', 'doors']
        : family === 'sliding'
          ? ['sliding-doors', 'doors']
          : []

  for (const product of products) {
    for (const key of preferredCategoryKeys) {
      const match = product.categories.find((c) => c.key === key)
      if (match) return { productKey: product.key, categoryKey: match.key }
    }
  }

  return { productKey: first.key, categoryKey: first.categories[0]?.key ?? '' }
}
