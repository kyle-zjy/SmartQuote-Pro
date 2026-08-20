import type { ExtraOption, Extras, PriceCategory } from '../types/pricing'

export type PriceLookupResult =
  | { ok: true; price: number; matchedWidth: number; matchedHeight: number; clampedToMin: boolean }
  | { ok: false; reason: 'TOO_LARGE' | 'UNAVAILABLE' }

/**
 * Finds the price for a given width/height by rounding up to the next
 * available bracket in the size matrix -- you can never make a screen
 * smaller than requested, so any size between two brackets is billed at
 * the next size up.
 */
export function findPrice(category: PriceCategory, widthMm: number, heightMm: number): PriceLookupResult {
  const widthIndex = bracketIndex(category.widths, widthMm)
  const heightIndex = bracketIndex(category.heights, heightMm)
  if (widthIndex === -1 || heightIndex === -1) {
    return { ok: false, reason: 'TOO_LARGE' }
  }

  const price = category.prices[heightIndex][widthIndex]
  if (price === null) {
    return { ok: false, reason: 'UNAVAILABLE' }
  }

  return {
    ok: true,
    price,
    matchedWidth: category.widths[widthIndex],
    matchedHeight: category.heights[heightIndex],
    clampedToMin: widthMm < category.widths[0] || heightMm < category.heights[0],
  }
}

/** Index of the smallest bracket value >= target, or -1 if target exceeds every bracket. */
function bracketIndex(brackets: number[], target: number): number {
  for (let i = 0; i < brackets.length; i++) {
    if (brackets[i] >= target) return i
  }
  return -1
}

/** Extra surcharge for a mesh upgrade, chosen by whether the height is under/over the threshold. */
export function extraSurcharge(extras: Extras, optionName: string, heightMm: number): number {
  const option = extras.options.find((o: ExtraOption) => o.name === optionName)
  if (!option) return 0
  const threshold = extras.thresholdMm ?? Infinity
  const value = heightMm < threshold ? option.under : option.over
  return value ?? 0
}
