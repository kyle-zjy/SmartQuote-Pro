import type { PriceCategory } from '../types/pricing'
import { extraSurcharge, findPrice, type PriceLookupResult } from './priceLookup'

export const STANDARD_MESH = 'Standard'
export const DOUBLE_HUNG_SURCHARGE = 15

export function calcConfiguredPrice(
  category: PriceCategory,
  widthMm: number,
  heightMm: number,
  options: { meshOption?: string; doubleHung?: boolean } = {},
): { lookup: PriceLookupResult; extras: number; unitPrice: number | null } {
  const lookup = findPrice(category, widthMm, heightMm)
  const meshOption = options.meshOption ?? STANDARD_MESH
  const meshSurcharge = category.extras ? extraSurcharge(category.extras, meshOption, heightMm) : 0
  const extras = meshSurcharge + (options.doubleHung ? DOUBLE_HUNG_SURCHARGE : 0)

  return {
    lookup,
    extras,
    unitPrice: lookup.ok ? lookup.price + extras : null,
  }
}
