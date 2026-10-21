export function padMm(n: number): string {
  return String(Math.round(n)).padStart(4, '0')
}

export function openingLabel(categoryKey: string, categoryLabel: string): string {
  if (categoryKey.includes('sliding')) return 'sliding door'
  if (categoryKey.includes('hinged')) return 'hinged door'
  if (categoryKey === 'doors') return 'door'
  if (categoryKey === 'windows') return 'window screen'
  return categoryLabel.toLowerCase()
}

/** Standard product/material wording from Item list - ANU.xls (ITEM list 28-9-26).
 * Selected mesh replaces the standard material; hardware remains in its own options. */
export function productQuoteLabel(input: {
  productKey: string
  productName: string
  categoryKey: string
  categoryLabel: string
  configurationCode?: string
  meshOption?: string
}): string {
  const products: Record<string, { name: string; mesh: string }> = {
    supascreen: { name: 'SupaScreen', mesh: '316 marine grade stainless steel woven mesh' },
    intrudaguard: { name: 'Intrudaguard', mesh: '5052 marine grade aluminium perforated mesh' },
    '7mm-diamond': { name: '7mm Diamond Grille (Barrier ONLY)', mesh: 'fibreglass mesh' },
    flyscreens: { name: 'Flyscreen', mesh: 'fibreglass mesh' },
  }
  const product = products[input.productKey]
  const opening = input.categoryKey === 'windows' ? 'FIXED window screen'
    : input.configurationCode?.startsWith('HD') ? 'hinged door'
    : input.configurationCode?.startsWith('SD') ? 'sliding door'
    : openingLabel(input.categoryKey, input.categoryLabel)
  const label = opening.charAt(0).toUpperCase() + opening.slice(1)
  const mesh = input.meshOption && input.meshOption !== 'Standard' ? input.meshOption : product?.mesh
  return `${product?.name ?? input.productName} - ${label}${mesh ? ` with ${mesh}` : ''}`
}

/** Formats the complete item size in the customer-facing Height × Width convention. */
export function formatItemDimensions(heightMm: number, widthMm: number): string {
  return `${Math.round(heightMm)} × ${Math.round(widthMm)} mm`
}

export interface StructuredDescriptionInput {
  location?: string
  productLabel?: string
  widthMm?: number
  heightMm?: number
}

/** Builds a readable line-item description from structured opening/product fields, e.g. "Living Room — Supascreen Sliding Door — 1234 x 2123 mm". */
export function describeStructuredItem(input: StructuredDescriptionInput): string {
  const parts: string[] = []
  if (input.location?.trim()) parts.push(input.location.trim())
  if (input.productLabel?.trim()) parts.push(input.productLabel.trim())
  if (input.heightMm && input.widthMm && input.heightMm > 0 && input.widthMm > 0) {
    parts.push(`${padMm(input.heightMm)} x ${padMm(input.widthMm)} mm`)
  }
  return parts.length > 0 ? parts.join(' — ') : 'New item'
}

export function formatQuoteDescription(input: {
  widthMm: number
  heightMm: number
  productName: string
  categoryKey: string
  categoryLabel: string
  meshOption?: string
  extras?: string[]
  room: string
}): string {
  const size = `${padMm(input.heightMm)} x ${padMm(input.widthMm)}`
  const opening = openingLabel(input.categoryKey, input.categoryLabel)
  const mesh = input.meshOption && input.meshOption !== 'Standard' ? ` with ${input.meshOption}` : ''
  const extras = input.extras?.length ? ` with ${input.extras.join(', ')}` : ''
  const room = input.room.trim() ? ` *${input.room.trim()}` : ''
  return `${size} ${input.productName} ${opening}${mesh}${extras}${room}`
}
