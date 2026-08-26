export const OTHER_FRAME_COLOUR = 'Non-standard / Other'

export function isOtherFrameColour(name: string): boolean {
  return name === OTHER_FRAME_COLOUR
}

export function displayFrameColour(frameColour: string, customFrameColour: string): string {
  const custom = customFrameColour.trim()
  if (isOtherFrameColour(frameColour) && custom) return custom
  return frameColour
}
