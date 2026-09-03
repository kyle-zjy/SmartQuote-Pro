// Preset location/room options offered when adding or reusing an opening.
// Numbered bedrooms/bathrooms are deliberately separate entries (never a generic
// "Bedroom"/"Bathroom") so quote items for different physical rooms never get merged.
export const COMMON_LOCATIONS = ['Living Room', 'Kitchen', 'Dining Room', 'Front Entry', 'Laundry', 'Garage']

export const BEDROOM_LOCATIONS = ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4']

export const BATHROOM_LOCATIONS = ['Bathroom 1', 'Bathroom 2']

/** Flat list of every preset location, kept for callers that just want "all presets". */
export const ROOM_TYPES = [...COMMON_LOCATIONS, ...BEDROOM_LOCATIONS, ...BATHROOM_LOCATIONS]

/**
 * Normalizes a location for comparison only (trims whitespace, lower-cases, collapses
 * internal spacing). Never use this for display -- the user-facing label must be preserved
 * verbatim so "Bedroom 1" and "Bedroom 2" stay distinct rooms.
 */
export function normalizeLocationKey(location: string): string {
  return location.trim().toLowerCase().replace(/\s+/g, ' ')
}
