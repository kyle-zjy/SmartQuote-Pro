export function displayQuoteNo(quoteNo: string, suffix: string): string {
  const clean = suffix.trim().replace(/^-+/, '')
  return clean ? `${quoteNo}-${clean}` : quoteNo
}
