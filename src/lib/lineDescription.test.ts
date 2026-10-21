import { describe, expect, it } from 'vitest'
import { formatItemDimensions, formatQuoteDescription, padMm, productQuoteLabel, describeStructuredItem } from './lineDescription'

describe('standard product quote descriptions', () => {
  const base = { productKey: 'supascreen', productName: 'Supascreen', categoryKey: 'hinged-doors', categoryLabel: 'Hinged Doors' }
  it('includes the approved SupaScreen hinged door material in the saved description', () => {
    const productLabel = productQuoteLabel(base)
    expect(productLabel).toBe('SupaScreen - Hinged door with 316 marine grade stainless steel woven mesh')
    expect(describeStructuredItem({ location: 'Lounge', productLabel, heightMm: 2100, widthMm: 925 }))
      .toBe('Lounge — SupaScreen - Hinged door with 316 marine grade stainless steel woven mesh — 2100 x 0925 mm')
  })
  it.each([
    ['intrudaguard', 'Intrudaguard - Hinged door with 5052 marine grade aluminium perforated mesh'],
    ['7mm-diamond', '7mm Diamond Grille (Barrier ONLY) - Hinged door with fibreglass mesh'],
    ['flyscreens', 'Flyscreen - Hinged door with fibreglass mesh'],
  ])('describes the standard material for %s', (productKey, expected) => {
    expect(productQuoteLabel({ ...base, productKey })).toBe(expected)
  })
  it('describes sliding doors and fixed window screens', () => {
    expect(productQuoteLabel({ ...base, categoryKey: 'doors', configurationCode: 'HDX-L' })).toContain('Hinged door with 316')
    expect(productQuoteLabel({ ...base, categoryKey: 'doors', configurationCode: 'SDOX' })).toContain('Sliding door with 316')
    expect(productQuoteLabel({ ...base, categoryKey: 'sliding-doors' })).toContain('Sliding door with 316')
    expect(productQuoteLabel({ ...base, categoryKey: 'windows' })).toContain('FIXED window screen with 316')
  })
  it('uses the selected mesh instead of claiming the standard material', () => {
    expect(productQuoteLabel({ ...base, productKey: 'flyscreens', meshOption: 'PETMESH' }))
      .toBe('Flyscreen - Hinged door with PETMESH')
  })
  it('retains imported product names for unknown products', () => {
    expect(productQuoteLabel({ ...base, productKey: 'custom', productName: 'Custom screen' }))
      .toBe('Custom screen - Hinged door')
  })
})

describe('padMm', () => {
  it('pads quote sizes the way Goldco PDFs do', () => {
    expect(padMm(925)).toBe('0925')
    expect(padMm(2100)).toBe('2100')
  })
})

describe('formatQuoteDescription', () => {
  it('matches the live quote wording pattern', () => {
    expect(
      formatQuoteDescription({
        widthMm: 925,
        heightMm: 2100,
        productName: 'Supascreen',
        categoryKey: 'sliding-doors',
        categoryLabel: 'Sliding Doors',
        meshOption: '316 stainless mesh',
        extras: ['top track'],
        room: 'Lounge',
      }),
    ).toBe('2100 x 0925 Supascreen sliding door with 316 stainless mesh with top track *Lounge')
  })
})

describe('formatItemDimensions', () => {
  it('always displays the complete item as Height × Width in millimetres', () => {
    expect(formatItemDimensions(2100, 1800)).toBe('2100 × 1800 mm')
  })
})
