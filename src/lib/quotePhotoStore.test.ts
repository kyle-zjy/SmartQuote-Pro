import { describe, expect, it } from 'vitest'
import { normalizeQuote, quoteReducer } from './quoteContext'
import { restoreRoomPhotoData } from './quotePhotoStore'

describe('photo recovery', () => {
  it('restores missing image bytes while preserving new captions and removals', () => {
    const stored = { Living: [{ id: 'keep', dataUrl: 'data:original', caption: 'Old' }, { id: 'removed', dataUrl: 'data:removed', caption: '' }] }
    const current = { Living: [{ id: 'keep', dataUrl: '', caption: 'Edited' }] }
    expect(restoreRoomPhotoData(current, stored)).toEqual({ Living: [{ id: 'keep', dataUrl: 'data:original', caption: 'Edited' }] })
    expect(restoreRoomPhotoData({}, stored)).toEqual({})
  })

  it('preserves newly uploaded image bytes and added photos during loading', () => {
    const current = { Room: [{ id: '1', dataUrl: 'data:new', caption: 'New' }, { id: '2', dataUrl: 'data:added', caption: '' }] }
    expect(restoreRoomPhotoData(current, { Room: [{ id: '1', dataUrl: 'data:old', caption: 'Old' }] })).toEqual(current)
  })

  it('rejects a late photo load from another quote or revision', () => {
    const quote = normalizeQuote({ quoteNo: 'A', version: 2 })
    const roomPhotos = { Room: [{ id: '1', dataUrl: 'data:test', caption: '' }] }
    expect(quoteReducer(quote, { type: 'HYDRATE_PHOTOS', quoteNo: 'B', version: 2, roomPhotos })).toBe(quote)
    expect(quoteReducer(quote, { type: 'HYDRATE_PHOTOS', quoteNo: 'A', version: 1, roomPhotos })).toBe(quote)
    expect(quoteReducer(quote, { type: 'HYDRATE_PHOTOS', quoteNo: 'A', version: 2, roomPhotos }).roomPhotos).toEqual(roomPhotos)
  })
})
