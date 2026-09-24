import type { QuoteState, RoomPhoto } from './quoteContext'

export const DRAFT_STORAGE_KEY = 'smartquote-pro:quote'
export const DRAFT_PERSIST_MS = 300

export const MEASURE_LEGACY_DRAFT_PERSIST = false

export interface PersistTimings {
  photoChars: number
  bytesWritten: number
  stringifyMs: number
  writeMs: number
  totalMs: number
}

function roundMs(startedAt: number, endedAt = performance.now()): number {
  return Math.round((endedAt - startedAt) * 10) / 10
}

export function photoDataChars(roomPhotos: Record<string, RoomPhoto[]>): number {
  let chars = 0
  for (const photos of Object.values(roomPhotos)) {
    for (const photo of photos) chars += photo.dataUrl.length
  }
  return chars
}

export function hasPhotoData(roomPhotos: Record<string, RoomPhoto[]>): boolean {
  return photoDataChars(roomPhotos) > 0
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/** Full photo strip (room + item photos), used only as a last-resort fallback when a write hits the storage quota -- item photos have no separate store, so this is never applied to the normal save path. */
export function stripPhotoData(state: QuoteState): QuoteState {
  const roomPhotos: Record<string, RoomPhoto[]> = {}
  for (const [room, photos] of Object.entries(state.roomPhotos)) {
    roomPhotos[room] = photos.map((photo) => ({ id: photo.id, caption: photo.caption, dataUrl: '' }))
  }
  const items = state.items.map((item) =>
    item.photos && item.photos.length > 0
      ? { ...item, photos: item.photos.map((photo) => ({ ...photo, dataUrl: '', annotatedDataUrl: null })) }
      : item,
  )
  return { ...state, roomPhotos, items }
}

function stripRoomPhotoData(state: QuoteState): QuoteState {
  const roomPhotos: Record<string, RoomPhoto[]> = {}
  for (const [room, photos] of Object.entries(state.roomPhotos)) {
    roomPhotos[room] = photos.map((photo) => ({ id: photo.id, caption: photo.caption, dataUrl: '' }))
  }
  return { ...state, roomPhotos }
}

export function persistDraftQuote(
  state: QuoteState,
  storage: Storage = localStorage,
  options: { log?: boolean; includePhotos?: boolean } = {},
): PersistTimings {
  const includePhotos = options.includePhotos === true
  const totalStartedAt = performance.now()
  const photoChars = photoDataChars(state.roomPhotos)

  // Room photos are backed up separately in IndexedDB, so they're always safe to leave out of the
  // draft blob. Item photos have no other store -- keep them in on the normal path, and only fall
  // back to stripping them too if the full write hits the storage quota, so a large photo can't
  // silently take the whole draft (customer, items, pricing) down with it.
  const base = includePhotos ? state : stripRoomPhotoData(state)

  const stringifyStartedAt = performance.now()
  let payload = JSON.stringify(base)
  const stringifyMs = roundMs(stringifyStartedAt)

  const writeStartedAt = performance.now()
  try {
    storage.setItem(DRAFT_STORAGE_KEY, payload)
  } catch (error) {
    if (!isQuotaError(error)) throw error
    payload = JSON.stringify(stripPhotoData(base))
    storage.setItem(DRAFT_STORAGE_KEY, payload)
  }
  const writeMs = roundMs(writeStartedAt)

  const timings: PersistTimings = {
    photoChars,
    bytesWritten: payload.length,
    stringifyMs,
    writeMs,
    totalMs: roundMs(totalStartedAt),
  }
  if (options.log) console.info('[quote-persist]', { ...timings, legacy: includePhotos })
  return timings
}
