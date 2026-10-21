import { workspaceStorage } from './workspaceStorage'
import { SERVER_MODE } from './apiClient'
import type { QuoteState, RoomPhoto } from './quoteContext'

export const DRAFT_STORAGE_KEY = 'smartquote-pro:quote'
export const ACTIVE_QUOTE_KEY = 'smartquote-pro:active-quote'
export const QUOTE_DRAFT_PREFIX = 'smartquote-pro:draft:'
export const quoteDraftKey = (quoteNo: string, version: number) => `${QUOTE_DRAFT_PREFIX}${encodeURIComponent(quoteNo)}:v${version}`

export function readTabDraft(storage: Storage = workspaceStorage, tabStorage: Storage = sessionStorage): string | null {
  const legacy = storage.getItem(DRAFT_STORAGE_KEY)
  try {
    const pointer = JSON.parse(tabStorage.getItem(ACTIVE_QUOTE_KEY) ?? 'null') as [string, number] | null
    if (!Array.isArray(pointer) || pointer.length !== 2 || typeof pointer[0] !== 'string' || !Number.isSafeInteger(pointer[1]) || pointer[1] < 1) return legacy
    const parsed = legacy ? JSON.parse(legacy) as QuoteState : null
    // Shared hydration updates the scoped copy. The compatibility last-opened
    // copy may still be stale after a cache outage; it must not mask server data.
    if (SERVER_MODE) return storage.getItem(quoteDraftKey(...pointer)) ?? legacy
    if (parsed?.quoteNo === pointer[0] && parsed.version === pointer[1]) return legacy
    return storage.getItem(quoteDraftKey(...pointer)) ?? legacy
  } catch {
    return legacy
  }
}
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

export function isQuotaError(error: unknown): boolean {
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

export function stripRoomPhotoData(state: QuoteState): QuoteState {
  const roomPhotos: Record<string, RoomPhoto[]> = {}
  for (const [room, photos] of Object.entries(state.roomPhotos)) {
    roomPhotos[room] = photos.map((photo) => ({ id: photo.id, caption: photo.caption, dataUrl: '' }))
  }
  return { ...state, roomPhotos }
}

export function persistDraftQuote(
  state: QuoteState,
  storage: Storage = workspaceStorage,
  options: { log?: boolean; includePhotos?: boolean; scoped?: boolean } = {},
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
  const key = options.scoped ? quoteDraftKey(state.quoteNo, state.version) : DRAFT_STORAGE_KEY
  try {
    storage.setItem(key, payload)
  } catch (error) {
    if (!isQuotaError(error)) throw error
    payload = JSON.stringify(stripPhotoData(base))
    storage.setItem(key, payload)
  }
  if (options.scoped) {
    // Keep the legacy last-opened copy for existing browsers; each tab resumes via its own pointer.
    try { storage.setItem(DRAFT_STORAGE_KEY, payload) } catch { /* The scoped draft is already saved. */ }
    try { sessionStorage.setItem(ACTIVE_QUOTE_KEY, JSON.stringify([state.quoteNo, state.version])) } catch { /* Storage may be unavailable. */ }
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
