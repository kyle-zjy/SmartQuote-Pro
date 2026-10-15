import { describe, expect, it } from 'vitest'
import type { PriceCategory, PricingData } from '../types/pricing'
import { calcConfiguredGroupPrice } from './configuredPrice'
import {
  calcSheetSize,
  adjustedPricingGroups,
  pricingSizeForItem,
  configLabel,
  findSheetConfig,
  lookupSheetUnitPrice,
  measurePoints,
  openingFromMeasures,
  sheetSizeFromMeasures,
  sheetLineAmount,
  sheetTotals,
  suggestedScreenType,
} from './quoteSheet'

describe('quoteSheet', () => {
  it.each(['add', '', 'remove', 'remove-zero'] as const)('keeps dimensions and price unchanged for interlock option %s', (interlockAdjustment) => {
    const measurements = { H1: '2100', H2: '2100', H3: '2100', W1: '900' }
    const size = sheetSizeFromMeasures(findSheetConfig('SDOX')!, measurements)!
    const groups = adjustedPricingGroups(size, interlockAdjustment)
    expect(groups).toEqual(size.pricingGroups)
    expect(pricingSizeForItem({ configurationCode: 'SDOX', measurements, interlockAdjustment }))
      .toEqual(pricingSizeForItem({ configurationCode: 'SDOX', measurements }))
    const category: PriceCategory = {
      key: 'doors', label: 'Doors', widths: [900, 905], heights: [2100],
      prices: [[300, 800]], extras: null,
    }
    expect(calcConfiguredGroupPrice(category, groups)).toEqual(calcConfiguredGroupPrice(category, size.pricingGroups))
  })
  it('loads the 19 configuration drawings from the student workbook', () => {
    expect(findSheetConfig('HDX-L')?.panels).toBe(1)
    expect(findSheetConfig('SDOXX')?.widthOffset).toBe(70)
    expect(findSheetConfig('WS')?.widthFactor).toBe(1)
  })

  it('uses drawn sliding widths directly and only divides multi-panel hinged doors', () => {
    expect(calcSheetSize(findSheetConfig('HDX-L')!, 2100, 900)).toMatchObject({
      panels: 1,
      openingHeight: 2100,
      openingWidth: 900,
      openingLabel: '2100X900',
      screenLabel: '2100X900',
    })
    expect(calcSheetSize(findSheetConfig('SDOX')!, 2100, 1200)).toMatchObject({
      panels: 1,
      openingWidth: 1200,
      screenHeight: 2100,
      screenWidth: 1200,
      screenLabel: '2100X1200',
    })
    expect(calcSheetSize(findSheetConfig('HDXX-L')!, 2100, 1800)).toMatchObject({
      panels: 2,
      openingWidth: 1800,
      openingLabel: '2100X1800',
      screenWidth: 900,
      pricingGroups: [{ height: 2100, width: 900, quantity: 2 }],
    })
    expect(sheetSizeFromMeasures(findSheetConfig('SDOXX')!, {
      H1: '2080', H2: '2100', H3: '2090', W1: '800', W2: '900',
    })).toMatchObject({
      panels: 2,
      openingWidth: 1700,
      screenWidth: 900,
      pricingGroups: [
        { height: 2100, width: 800, quantity: 1, measurementKey: 'W1' },
        { height: 2100, width: 900, quantity: 1, measurementKey: 'W2' },
      ],
    })
    expect(sheetSizeFromMeasures(findSheetConfig('SDOXXO-L')!, {
      H1: '2100', H2: '2100', H3: '2100', W1: '1500',
    })).toMatchObject({
      openingWidth: 1500,
      pricingGroups: [{
        height: 2100, width: 750, quantity: 2, measurementKey: 'W1', widthDivisor: 2,
      }],
    })
  })

  it('multiplies unit price by quantity and panel count', () => {
    expect(sheetLineAmount(500, 2, 2)).toBe(2000)
    expect(sheetTotals([2000, 110])).toEqual({ subtotal: 2110, gstAmount: 211, total: 2321 })
  })

  it('uses the largest marked height and width as the opening', () => {
    expect(openingFromMeasures({ H1: '2080', H2: '2100', W1: '900', W3: '880' })).toEqual({
      height: 2100,
      width: 900,
    })
    expect(openingFromMeasures(
      { H1: '2080', H2: '2100', W1: '900', W2: '880' },
      findSheetConfig('SDOXX'),
    )).toEqual({ height: 2100, width: 1780 })
    expect(measurePoints(findSheetConfig('HDX-L')!).heights).toEqual(['H1', 'H2'])
    expect(measurePoints(findSheetConfig('WS')!).widths).toEqual(['W1'])
    expect(measurePoints(findSheetConfig('SDOXX')!).heights).toEqual(['H1', 'H2', 'H3'])
    expect(measurePoints(findSheetConfig('SDOXX')!).widths).toEqual(['W1', 'W2'])
    expect(measurePoints(findSheetConfig('SDOXXXXXXO-L')!).widths).toEqual(['W1', 'W2', 'W3', 'W4', 'W5'])
    expect(measurePoints(findSheetConfig('SDOX')!).heights).toEqual(['H1', 'H2', 'H3'])
    expect(measurePoints(findSheetConfig('SDXO')!).heights).toEqual(['H1', 'H2', 'H3'])
  })

  it('suggests a screen type from the drawing code', () => {
    expect(suggestedScreenType('HDX-L')).toBe('Hinged Door')
    expect(suggestedScreenType('SDOXO-R')).toBe('Sliding Door')
    expect(suggestedScreenType('WS')).toBe('Window')
    expect(configLabel('HDX-L')).toContain('LHS')
    expect(configLabel('SDOXX')).toContain('RHS')
    expect(configLabel('SDXXO')).toContain('LHS')
  })

  it('looks up a matrix price from the calculated screen size', () => {
    const pricing: PricingData = {
      note: '',
      products: [
        {
          key: 'supascreen',
          name: 'Supascreen',
          pricingAsAt: null,
          categories: [
            {
              key: 'doors',
              label: 'Doors',
              widths: [900, 1200],
              heights: [2100],
              prices: [[400, 500]],
              extras: null,
            },
          ],
        },
      ],
    }
    expect(lookupSheetUnitPrice(pricing, 'Supascreen', 'Hinged Door', 1000, 2100)).toEqual({
      price: 500,
      matchedWidth: 1200,
      matchedHeight: 2100,
    })
    expect(lookupSheetUnitPrice(pricing, 'Diamond Grille', 'Hinged Door', 900, 2100)).toBeNull()
  })
})

describe('sliding screen pricing groups', () => {
  const category: PriceCategory = {
    key: 'sliding-doors',
    label: 'Sliding Doors',
    widths: [400, 500, 800, 1000],
    heights: [2100],
    // Deliberately non-linear: 2 × price(400) = 200, while price(800) = 260.
    prices: [[100, 130, 260, 500]],
    extras: null,
  }

  function calculate(code: string, widths: number[]) {
    const config = findSheetConfig(code)!
    const measurements = Object.fromEntries([
      ['H1', '2100'],
      ...widths.map((width, index) => [`W${index + 1}`, String(width)]),
    ])
    const size = sheetSizeFromMeasures(config, measurements)!
    return { size, price: calcConfiguredGroupPrice(category, size.pricingGroups).unitPrice }
  }

  it('prices a 1-screen sliding configuration from W1', () => {
    const { size, price } = calculate('SDOX', [500])
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 500, widthDivisor: 1, quantity: 1 },
    ])
    expect(price).toBe(130)
  })

  it('prices 2 separate sliding screens from W1 and W2', () => {
    const { size, price } = calculate('SDOXX', [400, 500])
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 400, quantity: 1 },
      { measurementKey: 'W2', width: 500, quantity: 1 },
    ])
    expect(price).toBe(230)
  })

  it('prices 2 screens sharing W1 as 2 × price(W1 / 2)', () => {
    const { size, price } = calculate('SDOXXO-L', [800])
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 400, widthDivisor: 2, quantity: 2 },
    ])
    expect(price).toBe(200)
    expect(price).not.toBe(260)
  })

  it('prices 3 sliding screens independently', () => {
    const { size, price } = calculate('SDOXXX', [400, 500, 800])
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 400, quantity: 1 },
      { measurementKey: 'W2', width: 500, quantity: 1 },
      { measurementKey: 'W3', width: 800, quantity: 1 },
    ])
    expect(price).toBe(490)
  })

  it('prices 4 screens as W1 + W2 + 2 × price(W3 / 2)', () => {
    const { size, price } = calculate('SDOXXXXO-L', [400, 500, 800])
    expect(size.openingWidth).toBe(1700)
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 400, quantity: 1 },
      { measurementKey: 'W2', width: 500, quantity: 1 },
      { measurementKey: 'W3', width: 400, widthDivisor: 2, quantity: 2 },
    ])
    expect(price).toBe(430)
    expect(price).not.toBe(490)
  })

  it('prices 6 screens as W1 + W2 + W3 + W4 + 2 × price(W5 / 2)', () => {
    const { size, price } = calculate('SDOXXXXXXO-L', [400, 500, 400, 500, 800])
    expect(size.openingWidth).toBe(2600)
    expect(size.pricingGroups).toMatchObject([
      { measurementKey: 'W1', width: 400, quantity: 1 },
      { measurementKey: 'W2', width: 500, quantity: 1 },
      { measurementKey: 'W3', width: 400, quantity: 1 },
      { measurementKey: 'W4', width: 500, quantity: 1 },
      { measurementKey: 'W5', width: 400, widthDivisor: 2, quantity: 2 },
    ])
    expect(price).toBe(660)
    expect(price).not.toBe(720)
  })

  it.each([
    ['SDOXXO-R', [800], 'W1'],
    ['SDOXXXXO-R', [400, 500, 800], 'W3'],
    ['SDOXXXXXO-R', [400, 500, 400, 500, 800], 'W5'],
  ])('applies the shared-width rule to %s', (code, widths, sharedKey) => {
    const { size } = calculate(code, widths as number[])
    expect(size.pricingGroups.find((group) => group.measurementKey === sharedKey)).toMatchObject({
      width: 400,
      widthDivisor: 2,
      quantity: 2,
    })
  })
})

describe('measurement table configuration coverage', () => {
  it.each([
    ['HDX-L', 1, ['H1', 'H2'], ['W1', 'W2', 'W3']],
    ['HDX-R', 1, ['H1', 'H2'], ['W1', 'W2', 'W3']],
    ['HDXX-L', 2, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['HDXX-R', 2, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['SDOX', 1, ['H1', 'H2', 'H3'], ['W1']],
    ['SDOXO-L', 1, ['H1', 'H2', 'H3'], ['W1']],
    ['SDOXO-R', 1, ['H1', 'H2', 'H3'], ['W1']],
    ['SDOXX', 2, ['H1', 'H2', 'H3'], ['W1', 'W2']],
    ['SDOXXO-L', 2, ['H1', 'H2', 'H3'], ['W1']],
    ['SDOXXO-R', 2, ['H1', 'H2', 'H3'], ['W1']],
    ['SDOXXX', 3, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['SDOXXXXO-L', 4, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['SDOXXXXO-R', 4, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['SDOXXXXXO-R', 6, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3', 'W4', 'W5']],
    ['SDOXXXXXXO-L', 6, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3', 'W4', 'W5']],
    ['SDXO', 1, ['H1', 'H2', 'H3'], ['W1']],
    ['SDXXO', 2, ['H1', 'H2', 'H3'], ['W1', 'W2']],
    ['SDXXXO', 3, ['H1', 'H2', 'H3'], ['W1', 'W2', 'W3']],
    ['WS', 1, ['H1'], ['W1']],
  ])('%s matches the table measurement points and screen count', (code, panels, heights, widths) => {
    const config = findSheetConfig(code as string)!
    expect(config.panels).toBe(panels)
    expect(measurePoints(config)).toEqual({ heights, widths })
  })

  it.each(['HDXX-L', 'HDXX-R'])('%s prices two hinged screens after halving the total width', (code) => {
    const config = findSheetConfig(code)!
    const size = sheetSizeFromMeasures(config, {
      H1: '2100', H2: '2090', H3: '2080', W1: '1800', W2: '1780', W3: '1790',
    })!
    const nonLinearCategory: PriceCategory = {
      key: 'doors',
      label: 'Doors',
      widths: [900, 1800],
      heights: [2100],
      prices: [[300, 800]],
      extras: null,
    }

    expect(size.pricingGroups).toMatchObject([{ width: 900, quantity: 2 }])
    expect(calcConfiguredGroupPrice(nonLinearCategory, size.pricingGroups).unitPrice).toBe(600)
    expect(calcConfiguredGroupPrice(nonLinearCategory, size.pricingGroups).unitPrice).not.toBe(800)
  })
})
