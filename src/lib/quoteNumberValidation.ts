export function isValidQuoteNumber(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,50}$/.test(value)
}
