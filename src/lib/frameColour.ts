export const OTHER_FRAME_COLOUR = 'Non-standard / Other'

export function isOtherFrameColour(name: string): boolean {
  return name === OTHER_FRAME_COLOUR
}

export function displayFrameColour(frameColour: string, customFrameColour: string): string {
  const custom = customFrameColour.trim()
  if (isOtherFrameColour(frameColour) && custom) return custom
  return frameColour
}

/** Resolves the colour actually used for a quote item: its own override, or the quote's default. */
export function effectiveFrameColour(
  item: { frameColourMode?: 'default' | 'custom'; customFrameColour?: string },
  quoteDefaultColour: string,
  quoteCustomColour: string,
): string {
  if (item.frameColourMode === 'custom' && item.customFrameColour?.trim()) {
    return item.customFrameColour.trim()
  }
  return displayFrameColour(quoteDefaultColour, quoteCustomColour)
}
