export interface QuoteDiscount {
  percent: number
  note: string
}

export function isValidDiscountPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

export function isValidQuoteDiscount(value: unknown): value is QuoteDiscount {
  if (!value || typeof value !== 'object') return false
  const discount = value as Record<string, unknown>
  return isValidDiscountPercent(discount.percent) && typeof discount.note === 'string' && discount.note.length <= 1000
}
