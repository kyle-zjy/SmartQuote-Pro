export function displayQuoteNo(quoteNo: string, quoteNumber: string): string {
  const clean = quoteNumber.trim()
  return clean || quoteNo
}

export function displayQuoteRevision(version: number): string {
  return `Rev ${Math.max(1, version || 1)}`
}
