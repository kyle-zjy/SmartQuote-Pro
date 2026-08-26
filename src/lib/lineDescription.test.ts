import { describe, expect, it } from 'vitest'
import { formatQuoteDescription, padMm } from './lineDescription'

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
