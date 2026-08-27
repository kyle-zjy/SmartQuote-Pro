export function displayQuoteNo(quoteNo: string, suffix: string): string {
  const clean = suffix.trim().replace(/^-+/, '')
  return clean ? `${quoteNo}-${clean}` : quoteNo
}

export function displayQuoteRevision(version: number): string {
  return `Rev ${Math.max(1, version || 1)}`
}
