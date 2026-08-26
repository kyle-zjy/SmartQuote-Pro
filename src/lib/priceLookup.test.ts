import { describe, expect, it } from 'vitest'
import type { PriceCategory } from '../types/pricing'
import { extraSurcharge, findPrice } from './priceLookup'
import { calcConfiguredPrice, DOUBLE_HUNG_SURCHARGE, STANDARD_MESH } from './configuredPrice'

const category: PriceCategory = {
  key: 'windows',
  label: 'Windows',
  widths: [300, 450, 600],
  heights: [600, 750],
  prices: [
    [100, 200, 300],
    [150, 250, null],
  ],
  extras: {
    thresholdMm: 1500,
    options: [{ name: 'PETMESH', under: 40, over: 80 }],
  },
}

describe('findPrice', () => {
  it('returns the exact matrix cell when size hits a bracket', () => {
    const result = findPrice(category, 300, 600)
    expect(result).toEqual({
      ok: true,
      price: 100,
      matchedWidth: 300,
      matchedHeight: 600,
      clampedToMin: false,
    })
  })

  it('rounds each side up to the next bracket, never down', () => {
    const result = findPrice(category, 320, 610)
    expect(result).toMatchObject({
      ok: true,
      price: 250,
      matchedWidth: 450,
      matchedHeight: 750,
    })
  })

  it('bills undersized requests at the smallest bracket and flags the clamp', () => {
    const result = findPrice(category, 200, 500)
    expect(result).toMatchObject({ ok: true, price: 100, clampedToMin: true })
  })

  it('rejects sizes larger than the matrix', () => {
    expect(findPrice(category, 700, 600)).toEqual({ ok: false, reason: 'TOO_LARGE' })
  })

  it('rejects a bracket pair marked unavailable in the spreadsheet', () => {
    expect(findPrice(category, 600, 750)).toEqual({ ok: false, reason: 'UNAVAILABLE' })
  })
})

describe('extraSurcharge', () => {
  it('uses the under-threshold price when height is strictly below the cutover', () => {
    expect(extraSurcharge(category.extras!, 'PETMESH', 1499)).toBe(40)
  })

  it('uses the over-threshold price at and above the cutover', () => {
    expect(extraSurcharge(category.extras!, 'PETMESH', 1500)).toBe(80)
  })

  it('returns 0 for a mesh name that is not in the list', () => {
    expect(extraSurcharge(category.extras!, STANDARD_MESH, 900)).toBe(0)
  })
})

describe('calcConfiguredPrice', () => {
  it('adds mesh and double-hung extras on top of the matrix price', () => {
    const result = calcConfiguredPrice(category, 300, 600, {
      meshOption: 'PETMESH',
      doubleHung: true,
    })
    expect(result.lookup.ok).toBe(true)
    expect(result.extras).toBe(40 + DOUBLE_HUNG_SURCHARGE)
    expect(result.unitPrice).toBe(100 + 40 + DOUBLE_HUNG_SURCHARGE)
  })

  it('keeps unitPrice null when the size cannot be quoted', () => {
    const result = calcConfiguredPrice(category, 900, 600)
    expect(result.unitPrice).toBeNull()
  })
})
