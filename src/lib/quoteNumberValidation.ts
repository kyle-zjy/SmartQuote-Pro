export function isValidQuoteNumber(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && Array.from(trimmed).length <= 50
}
