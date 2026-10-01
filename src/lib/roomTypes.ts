// Room type options offered when adding an opening. "Custom" lets staff type a location
// that isn't one of the presets -- it is a UI sentinel only and is never itself printed.
export const ROOM_TYPE_OPTIONS = ['Bedroom', 'Living Room', 'Bathrooms', 'Front Door']

export const CUSTOM_ROOM_TYPE = 'Custom'

/**
 * Normalizes a location for comparison only (trims whitespace, lower-cases, collapses
 * internal spacing). Never use this for display -- the user-facing label must be preserved
 * verbatim so "Bedroom 1" and "Bedroom 2" stay distinct rooms.
 */
export function normalizeLocationKey(location: string): string {
  return location.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Combines a dropdown room type with its optional free-text detail into a single location string. */
export function composeRoomLocation(roomType: string, detail: string): string {
  const trimmedDetail = detail.trim()
  if (roomType === CUSTOM_ROOM_TYPE) return trimmedDetail
  if (!roomType) return trimmedDetail
  return trimmedDetail ? `${roomType} ${trimmedDetail}` : roomType
}

/** Splits a stored location string back into a dropdown room type + its detail text, for editing. */
export function splitRoomLocation(location: string): { roomType: string; detail: string } {
  const trimmed = location.trim()
  if (!trimmed) return { roomType: '', detail: '' }
  for (const option of ROOM_TYPE_OPTIONS) {
    if (trimmed === option) return { roomType: option, detail: '' }
    if (trimmed.startsWith(`${option} `)) return { roomType: option, detail: trimmed.slice(option.length + 1).trim() }
  }
  return { roomType: CUSTOM_ROOM_TYPE, detail: trimmed }
}
