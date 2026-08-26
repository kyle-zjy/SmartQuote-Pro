import { describe, expect, it } from 'vitest'
import { OTHER_FRAME_COLOUR, displayFrameColour, isOtherFrameColour } from './frameColour'

describe('displayFrameColour', () => {
  it('uses the typed name when Other is selected', () => {
    expect(displayFrameColour(OTHER_FRAME_COLOUR, '  Stromboli  ')).toBe('Stromboli')
  })

  it('falls back to Other when no custom name is entered', () => {
    expect(displayFrameColour(OTHER_FRAME_COLOUR, '   ')).toBe(OTHER_FRAME_COLOUR)
  })

  it('keeps a standard colour name', () => {
    expect(displayFrameColour('White', 'Stromboli')).toBe('White')
    expect(isOtherFrameColour('White')).toBe(false)
  })
})
