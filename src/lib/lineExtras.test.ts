import { describe, expect, it } from 'vitest'
import { fitExtraPhrase } from './lineExtras'

describe('fitExtraPhrase', () => {
  it('maps addon names to the phrase used on Goldco quotes', () => {
    expect(fitExtraPhrase('TOP TRACKS')).toBe('top track')
    expect(fitExtraPhrase('LOCK POSTS')).toBe('lock post')
    expect(fitExtraPhrase('BOTTOM TRACK')).toBe('bottom track')
    expect(fitExtraPhrase('TRIPLE LOCKS')).toBe('triple lock')
  })
})
