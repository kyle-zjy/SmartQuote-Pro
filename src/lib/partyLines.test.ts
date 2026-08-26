import { describe, expect, it } from 'vitest'
import { addressLines, partyLines } from './partyLines'

describe('addressLines', () => {
  it('keeps explicit line breaks', () => {
    expect(addressLines('27/19 Santa Babara Rd\nHope Island QLD')).toEqual([
      '27/19 Santa Babara Rd',
      'Hope Island QLD',
    ])
  })

  it('splits a single comma-separated line for older quotes', () => {
    expect(addressLines('27/19 Santa Babara Rd, Hope Island QLD')).toEqual([
      '27/19 Santa Babara Rd',
      'Hope Island QLD',
    ])
  })
})

describe('partyLines', () => {
  it('puts name, address lines and phone in order', () => {
    expect(partyLines('Frank Cain', '27/19 Santa Babara Rd\nHope Island QLD', '0482-834-594')).toEqual([
      'Frank Cain',
      '27/19 Santa Babara Rd',
      'Hope Island QLD',
      '0482-834-594',
    ])
  })
})
