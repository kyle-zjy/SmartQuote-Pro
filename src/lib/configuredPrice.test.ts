import { describe, expect, it } from 'vitest'
import type { PriceCategory } from '../types/pricing'
import { calcConfiguredGroupPrice } from './configuredPrice'

const category: PriceCategory = {
  key: 'sliding-doors',
  label: 'Sliding Doors',
  widths: [800, 900, 1000],
  heights: [2100],
  prices: [[300, 350, 400]],
  extras: null,
}

describe('calcConfiguredGroupPrice', () => {
  it('adds independently bracketed W groups and their screen quantities', () => {
    expect(calcConfiguredGroupPrice(category, [
      { width: 780, height: 2100, quantity: 1 },
      { width: 850, height: 2100, quantity: 2 },
    ])).toEqual({ ok: true, unitPrice: 1000, extras: 0 })
  })

  it('fails the whole opening when any drawn width is unavailable', () => {
    expect(calcConfiguredGroupPrice(category, [
      { width: 800, height: 2100, quantity: 1 },
      { width: 1100, height: 2100, quantity: 1 },
    ])).toEqual({ ok: false, unitPrice: null, extras: 0 })
  })
})
