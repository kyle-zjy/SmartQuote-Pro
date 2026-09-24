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
