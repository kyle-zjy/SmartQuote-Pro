import { describe, expect, it } from 'vitest'
import {
  adjacentRevisions,
  countSnapshotPhotos,
  mergeRoomPhotos,
  photosForRoom,
  snapshotProductName,
  snapshotRooms,
} from './revisionSnapshot'

describe('mergeRoomPhotos', () => {
  it('fills empty archive data URLs from IndexedDB and keeps captions', () => {
    const merged = mergeRoomPhotos(
      { Lounge: [{ id: 'p1', dataUrl: '', caption: 'front door' }] },
      { Lounge: [{ id: 'p1', dataUrl: 'data:image/png;base64,abc', caption: '' }] },
    )
    expect(merged.Lounge).toEqual([{ id: 'p1', dataUrl: 'data:image/png;base64,abc', caption: 'front door' }])
  })

  it('keeps photos that only exist in one source', () => {
    const merged = mergeRoomPhotos(
      { Lounge: [{ id: 'a', dataUrl: 'data:a', caption: 'from archive' }] },
      { Kitchen: [{ id: 'b', dataUrl: 'data:b', caption: 'from store' }] },
    )
    expect(merged.Lounge?.[0]?.id).toBe('a')
    expect(merged.Kitchen?.[0]?.id).toBe('b')
  })

  it('treats a blank room name as Unassigned', () => {
    const merged = mergeRoomPhotos({ '': [{ id: 'p1', dataUrl: 'data:x', caption: '' }] }, null)
    expect(merged.Unassigned).toHaveLength(1)
  })
})

describe('snapshotRooms', () => {
  it('lists item rooms first, then photo-only rooms', () => {
    expect(
      snapshotRooms(
        [{ room: 'Lounge' }, { room: '' }, { room: 'Lounge' }],
        { Garage: [{ id: 'p1', dataUrl: 'data:x', caption: '' }] },
      ),
    ).toEqual(['Lounge', 'Unassigned', 'Garage'])
  })
})

describe('photosForRoom', () => {
  it('returns Unassigned photos stored under a blank key', () => {
    expect(photosForRoom({ '': [{ id: 'p1', dataUrl: 'data:x', caption: 'note' }] }, 'Unassigned')).toEqual([
      { id: 'p1', dataUrl: 'data:x', caption: 'note' },
    ])
  })
})

describe('countSnapshotPhotos', () => {
  it('counts records and images separately', () => {
    expect(
      countSnapshotPhotos({
        Lounge: [
          { id: 'p1', dataUrl: 'data:x', caption: '' },
          { id: 'p2', dataUrl: '', caption: 'missing' },
        ],
      }),
    ).toEqual({ total: 2, withImage: 1 })
  })
})

describe('snapshotProductName', () => {
  it('maps known product keys and labels add-ons', () => {
    expect(snapshotProductName('supascreen')).toBe('Supascreen')
    expect(snapshotProductName(undefined)).toBe('Add-on / other')
  })
})

describe('adjacentRevisions', () => {
  it('finds older and newer versions', () => {
    const versions = [{ version: 3 }, { version: 1 }, { version: 2 }]
    expect(adjacentRevisions(versions, 2)).toEqual({ older: { version: 1 }, newer: { version: 3 } })
    expect(adjacentRevisions(versions, 1)).toEqual({ older: undefined, newer: { version: 2 } })
  })
})
