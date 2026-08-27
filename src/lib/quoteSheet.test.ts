import { describe, expect, it } from 'vitest'
import type { PricingData } from '../types/pricing'
import {
  calcSheetSize,
  configLabel,
  findSheetConfig,
  lookupSheetUnitPrice,
  measurePoints,
  openingFromMeasures,
  sheetLineAmount,
  sheetTotals,
  suggestedScreenType,
} from './quoteSheet'

describe('quoteSheet', () => {
  it('loads the 19 configuration drawings from the student workbook', () => {
    expect(findSheetConfig('HDX-L')?.panels).toBe(1)
    expect(findSheetConfig('SDOXX')?.widthOffset).toBe(70)
    expect(findSheetConfig('WS')?.widthFactor).toBe(1)
  })

  it('calculates screen size the same way as the Excel sheet', () => {
    expect(calcSheetSize(findSheetConfig('HDX-L')!, 2100, 900)).toMatchObject({
      panels: 1,
      openingLabel: '2100X900',
      screenLabel: '2100X900',
    })
    expect(calcSheetSize(findSheetConfig('SDOX')!, 2100, 2400)).toMatchObject({
      panels: 1,
      screenHeight: 2100,
      screenWidth: 1200,
      screenLabel: '2100X1200',
    })
    expect(calcSheetSize(findSheetConfig('SDOXX')!, 2100, 3600)).toMatchObject({
      panels: 2,
      screenWidth: 1270,
      screenLabel: '2100X1270',
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
    expect(measurePoints(findSheetConfig('HDX-L')!).heights).toEqual(['H1', 'H2', 'H3'])
    expect(measurePoints(findSheetConfig('WS')!).widths).toEqual(['W1'])
    expect(measurePoints(findSheetConfig('SDOXX')!).heights).toEqual(['H1', 'H2', 'H3'])
  })

  it('suggests a screen type from the drawing code', () => {
    expect(suggestedScreenType('HDX-L')).toBe('Hinged Door')
    expect(suggestedScreenType('SDOXO-R')).toBe('Sliding Door')
    expect(suggestedScreenType('WS')).toBe('Window')
    expect(configLabel('HDX-L')).toContain('LHS')
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
