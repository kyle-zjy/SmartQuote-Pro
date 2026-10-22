import { isValidDiscountPercent } from './quoteDiscount'

export const GST_RATE = 0.1

export function money(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function lineAmount(unitPrice: number, quantity: number): number {
  return money(unitPrice * Math.max(0, quantity))
}

export function itemPrice(item: { unitPrice: number; finalPrice?: number }): number {
  return item.finalPrice ?? item.unitPrice
}

export function calcQuoteTotals(
  items: Array<{ unitPrice: number; finalPrice?: number; quantity: number }>,
  gstEnabled: boolean,
  extraCharges = 0,
  depositRate = 0.5,
  paid = 0,
  discountPercent = 0,
): {
  subtotalBeforeDiscount: number
  discountAmount: number
  subtotal: number
  gstAmount: number
  total: number
  deposit: number
  paid: number
  balance: number
} {
  if (!isValidDiscountPercent(discountPercent)) throw new Error('Enter a discount percentage from 0 to 100.')
  const subtotalBeforeDiscount = money(
    items.reduce((sum, item) => sum + lineAmount(itemPrice(item), item.quantity), 0) + extraCharges,
  )
  const discountAmount = money(subtotalBeforeDiscount * discountPercent / 100)
  const subtotal = money(subtotalBeforeDiscount - discountAmount)
  const gstAmount = gstEnabled ? money(subtotal * GST_RATE) : 0
  const total = money(subtotal + gstAmount)
  const paidAmt = money(Math.max(0, paid))
  return {
    subtotalBeforeDiscount,
    discountAmount,
    subtotal,
    gstAmount,
    total,
    deposit: money(total * depositRate),
    paid: paidAmt,
    balance: money(Math.max(0, total - paidAmt)),
  }
}
