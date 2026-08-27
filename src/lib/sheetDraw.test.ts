import { describe, expect, it } from 'vitest'
import { appendDrawPoint } from './sheetDraw'

describe('sheetDraw', () => {
  it('keeps the first point and skips tiny wobble', () => {
    const start = appendDrawPoint([], { x: 10, y: 10 })
    expect(start).toEqual([{ x: 10, y: 10 }])
    expect(appendDrawPoint(start, { x: 10.1, y: 10.1 })).toEqual(start)
    expect(appendDrawPoint(start, { x: 12, y: 10 })).toEqual([
      { x: 10, y: 10 },
      { x: 12, y: 10 },
    ])
  })
})
