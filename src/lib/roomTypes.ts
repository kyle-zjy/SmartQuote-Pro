// Common room type suggestions offered (via predictive text, not a fixed dropdown) when
// adding an opening. Staff can always type something else entirely -- these are starting
// points, not the only valid values.
export const NUMBERED_ROOM_TYPES = ['Bedroom', 'Bathroom']

export const SINGLE_ROOM_TYPES = ['Front Door', 'Living Room', 'Dining Room', 'Garage', 'Laundry', 'Kitchen']

export const ROOM_TYPE_OPTIONS = [...NUMBERED_ROOM_TYPES, ...SINGLE_ROOM_TYPES]

/** Room types houses typically have more than one of -- selecting these suggests the next number. */
export function isNumberedRoomType(roomType: string): boolean {
  return NUMBERED_ROOM_TYPES.includes(roomType)
}

/**
 * Normalizes a location for comparison only (trims whitespace, lower-cases, collapses
 * internal spacing). Never use this for display -- the user-facing label must be preserved
 * verbatim so "Bedroom 1" and "Bedroom 2" stay distinct rooms.
 */
export function normalizeLocationKey(location: string): string {
  return location.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Finds the next free number for a numbered room type (e.g. "Bedroom" -> 1, then 2, ...),
 * based on the highest number already used among existing locations on the quote.
 */
export function nextRoomNumber(roomType: string, existingLocations: string[]): number {
  const prefix = normalizeLocationKey(roomType)
  let highest = 0
  for (const location of existingLocations) {
    const normalized = normalizeLocationKey(location)
    if (!normalized.startsWith(`${prefix} `)) continue
    const suffix = normalized.slice(prefix.length + 1).trim()
    const n = Number(suffix)
    if (Number.isInteger(n) && n > highest) highest = n
  }
  return highest + 1
}
