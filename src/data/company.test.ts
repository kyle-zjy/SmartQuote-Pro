import { describe, expect, it } from 'vitest'
import { productWarrantyNotes } from './company'

describe('productWarrantyNotes', () => {
  it('uses the grille warranty for diamond grille quotes', () => {
    expect(productWarrantyNotes(['7mm-diamond'])).toEqual([
      'All Goldco® Security Group 7mm Diamond Grille products are backed by 7-year warranty',
    ])
  })

  it('uses the SupaScreen warranty for mesh products', () => {
    expect(productWarrantyNotes(['supascreen'])[0]).toContain('16-year warranty')
  })
})
