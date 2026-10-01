import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QuoteLineItemRow from '../components/QuoteLineItemRow'
import type { QuoteLineItem } from './quoteContext'
import { PET_DOOR_DISCLAIMER, petDoorOptions, productPrice, quoteExtras, removeQuoteExtra, type QuoteAudience } from './quotePrint'

const item: QuoteLineItem = {
  id: 'door', description: 'Supascreen hinged door', detail: '', room: 'Entry',
  quantity: 1, unitPrice: 900, note: 'Cut frame after site measure',
  lockHeightMm: 1000, lockSide: 'left', centreTongue: true, bowed: true,
  configurationCode: 'HDX-L', measurements: { H1: '2100' },
  addons: [{ name: 'PET DOOR - MEDIUM', price: 190 }],
}

function render(audience: QuoteAudience, line = item) {
  return renderToStaticMarkup(createElement(QuoteLineItemRow, {
    item: line, audience, readOnly: true, formatCurrency: (value) => `$${value}`,
  }))
}

describe('quote print audience', () => {
  it('shows the purchased pet door and automatic disclaimer only to the customer', () => {
    const customer = render('customer')
    expect(customer).toContain('Medium Pet Door')
    expect(customer).toContain(PET_DOOR_DISCLAIMER)
    for (const text of [item.note, 'Lock height', 'Lock side', 'Centre tongue', 'Door bowed']) {
      expect(customer).not.toContain(text)
    }
    const factory = render('factory')
    for (const text of [item.note, 'Medium Pet Door', 'Lock height', 'Lock side', 'Centre tongue', 'Door bowed', 'HDX-L', 'H1: 2100']) {
      expect(factory).toContain(text)
    }
    expect(factory).not.toContain(PET_DOOR_DISCLAIMER)
  })

  it('does not add a disclaimer for unrelated add-ons', () => {
    expect(render('customer', { ...item, addons: [{ name: 'TRIPLE LOCKS', price: 96 }] })).not.toContain(PET_DOOR_DISCLAIMER)
  })

  it('recognizes all explicit pet door options and deduplicates legacy fit extras', () => {
    expect(petDoorOptions({ addons: [
      { name: 'PET DOOR - SMALL', price: 180 },
      { name: 'PET DOOR - LARGE', price: 205 },
      { name: 'PET DOOR TO EXISTING DOOR', price: 340 },
    ], fitExtras: ['PET DOOR - SMALL', 'TRIPLE LOCKS'] })).toEqual([
      'Small Pet Door', 'Large Pet Door', 'PET DOOR TO EXISTING DOOR',
    ])
  })
})

describe('separate extras pricing', () => {
  it('splits multiple extras without changing quantity totals', () => {
    const line = { ...item, quantity: 2, addons: [...item.addons!, { name: 'BOX-OUTS', price: 75 }] }
    expect(productPrice(line)).toBe(635)
    expect((productPrice(line) + quoteExtras(line).reduce((sum, extra) => sum + extra.price, 0)) * line.quantity).toBe(1800)
    const html = render('customer', line)
    expect(html).toContain('Extra — Medium Pet Door')
    expect(html).toContain('Extra — BOX-OUTS')
    expect(html).toContain('$380')
    expect(html).toContain('$150')
    expect(html).toContain('$1270')
    expect(html).not.toContain('Included option')
  })

  it('removes one extra while preserving the product override and other extras', () => {
    const line = { ...item, quantity: 2, calculatedPrice: 900, finalPrice: 1000, priceOverridden: true,
      addons: [...item.addons!, { name: 'BOX-OUTS', price: 75 }] }
    const updated = { ...line, ...removeQuoteExtra(line, 'PET DOOR - MEDIUM') }
    expect(updated.unitPrice).toBe(810)
    expect(updated.finalPrice).toBe(810)
    expect(updated.calculatedPrice).toBe(710)
    expect(updated.priceOverridden).toBe(true)
    expect(productPrice(updated)).toBe(productPrice(line))
    expect(updated.addons).toEqual([{ name: 'BOX-OUTS', price: 75 }])
    expect(updated.finalPrice! * updated.quantity).toBe(1620)
    expect(render('customer', updated)).not.toContain(PET_DOOR_DISCLAIMER)
    expect(removeQuoteExtra(updated, 'not selected')).toEqual({})
  })

  it('uses saved fitting-extra prices and removes their selections consistently', () => {
    const line = { ...item, fitExtras: ['TOP TRACKS'], fitExtraPrices: [{ name: 'TOP TRACKS', price: 85 }] }
    expect(quoteExtras(line)).toContainEqual({ name: 'TOP TRACKS', price: 85 })
    const updated = { ...line, ...removeQuoteExtra(line, 'TOP TRACKS') }
    expect(updated.fitExtras).toEqual([])
    expect(updated.fitExtraPrices).toEqual([])
    expect(updated.unitPrice).toBe(815)
    expect(productPrice(updated)).toBe(productPrice(line))
  })
})

describe('custom customer notes', () => {
  it('uses edited notes only on the customer version', () => {
    const line = { ...item, customerNote: 'Customer approved the pet door location.\nConfirm access before installation.' }
    expect(render('customer', line)).toContain(line.customerNote)
    expect(render('customer', line)).not.toContain(PET_DOOR_DISCLAIMER)
    expect(render('factory', line)).not.toContain(line.customerNote)
    expect(render('factory', line)).toContain(item.note)
    const updated = { ...line, ...removeQuoteExtra(line, 'PET DOOR - MEDIUM') }
    expect(updated.customerNote).toBe(line.customerNote)
  })

  it('preserves a deliberately cleared note without regenerating the disclaimer', () => {
    expect(render('customer', { ...item, customerNote: '' })).not.toContain(PET_DOOR_DISCLAIMER)
  })

  it('clears only the unchanged default when the last pet door is removed', () => {
    const updated = { ...item, ...removeQuoteExtra({ ...item, customerNote: PET_DOOR_DISCLAIMER }, 'PET DOOR - MEDIUM') }
    expect(updated.customerNote).toBe('')
  })
})
