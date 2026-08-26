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

export function stripPhotoData(state: QuoteState): QuoteState {
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

  const stringifyStartedAt = performance.now()
  const payload = JSON.stringify(includePhotos ? state : stripPhotoData(state))
  const stringifyMs = roundMs(stringifyStartedAt)

  const writeStartedAt = performance.now()
  storage.setItem(DRAFT_STORAGE_KEY, payload)
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
