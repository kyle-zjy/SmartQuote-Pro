export function isValidQuoteNumber(value: string): boolean {
  return /^[A-Za-z0-9]{1,50}$/.test(value)
}
