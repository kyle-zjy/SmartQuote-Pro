import { describe, expect, it } from 'vitest'
import { formatPhone } from './phoneFormat'

describe('formatPhone', () => {
  it('formats a complete Australian mobile number', () => {
    expect(formatPhone('0417001615')).toBe('0417-001-615')
    expect(formatPhone('0417 001 615')).toBe('0417-001-615')
  })

  it('leaves incomplete and other numbers alone', () => {
    expect(formatPhone('0417001')).toBe('0417001')
    expect(formatPhone('07 5555 1234')).toBe('07 5555 1234')
  })
})
