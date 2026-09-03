import { describe, expect, it } from 'vitest'
import { productTone, productWarrantyLabel, productWarrantyNote, productWarrantyNotes } from './company'

describe('productWarrantyNotes', () => {
  it('uses the SupaScreen warranty only for Supascreen quotes', () => {
    expect(productWarrantyNotes(['supascreen'])).toEqual([
      'Additionally, Amplimesh® SupaScreen® products are backed by 16-year warranty and all doors are fitted with a triple lock system as per the Australian Standard',
    ])
  })

  it('uses the Intrudaguard warranty for Intrudaguard quotes', () => {
    expect(productWarrantyNotes(['intrudaguard'])).toEqual([
      'All Amplimesh® Intrudaguard® products are backed by 10-year warranty and all doors are fitted with a triple lock system as per the Australian Standard',
    ])
  })

  it('uses the grille warranty for diamond grille quotes', () => {
    expect(productWarrantyNotes(['7mm-diamond'])).toEqual([
      'All Goldco® Security Group 7mm Diamond Grille products are backed by 7-year warranty',
    ])
  })

  it('uses the flyscreen warranty for flyscreen quotes', () => {
    expect(productWarrantyNotes(['flyscreens'])).toEqual([
      'All Goldco® Security Group Flyscreen products are backed by 1-year warranty',
    ])
  })

  it('includes every matching product note on mixed quotes', () => {
    expect(productWarrantyNotes(['flyscreens', 'supascreen', '7mm-diamond'])).toEqual([
      'Additionally, Amplimesh® SupaScreen® products are backed by 16-year warranty and all doors are fitted with a triple lock system as per the Australian Standard',
      'All Goldco® Security Group 7mm Diamond Grille products are backed by 7-year warranty',
      'All Goldco® Security Group Flyscreen products are backed by 1-year warranty',
    ])
  })

  it('returns the note for a single product page', () => {
    expect(productWarrantyNote('intrudaguard')).toContain('10-year warranty')
    expect(productWarrantyNote('unknown')).toBeUndefined()
  })

  it('gives each product a distinct colour tone and warranty label', () => {
    expect(productTone('supascreen')).toBe('supascreen')
    expect(productTone('intrudaguard')).toBe('intrudaguard')
    expect(productTone('7mm-diamond')).toBe('diamond')
    expect(productTone('flyscreens')).toBe('flyscreens')
    expect(productWarrantyLabel('flyscreens')).toBe('1-year warranty')
  })
})
