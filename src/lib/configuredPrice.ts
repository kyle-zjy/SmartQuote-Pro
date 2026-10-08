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

export function calcConfiguredGroupPrice(
  category: PriceCategory,
  groups: Array<{ width: number; height: number; quantity: number }>,
  options: { meshOption?: string; doubleHung?: boolean } = {},
): { ok: boolean; unitPrice: number | null; extras: number } {
  const results = groups.map((group) => ({
    group,
    configured: calcConfiguredPrice(category, group.width, group.height, options),
  }))
  if (results.length === 0 || results.some(({ configured }) => !configured.lookup.ok || configured.unitPrice == null)) {
    return { ok: false, unitPrice: null, extras: 0 }
  }

  return results.reduce(
    (total, { group, configured }) => ({
      ok: true,
      unitPrice: total.unitPrice! + configured.unitPrice! * group.quantity,
      extras: total.extras + configured.extras * group.quantity,
    }),
    { ok: true, unitPrice: 0 as number | null, extras: 0 },
  )
}
