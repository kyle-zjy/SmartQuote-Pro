import type { RoomPhoto } from './quoteContext'
import { SERVER_MODE } from './apiClient'
import { remotePhotos, saveRemotePhotos, serverPhotoEntries, stageRemotePhotoEntries } from './serverWorkspace'

const DB_NAME = 'smartquote-pro'
const DB_VERSION = 1
const STORE = 'photos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
  })
}

function photoKey(quoteNo: string, version: number): string {
  return `${quoteNo}:v${Math.max(1, version || 1)}`
}

export async function readLocalPhotoEntries(): Promise<Record<string, Record<string, RoomPhoto[]>>> {
  if (typeof indexedDB === 'undefined') throw new Error('Photo storage is unavailable; a complete backup cannot be created.')
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const entries: Array<[string, Record<string, RoomPhoto[]>]> = []
      const tx = db.transaction(STORE, 'readonly')
      const cursor = tx.objectStore(STORE).openCursor()
      cursor.onsuccess = () => {
        const row = cursor.result
        if (!row) return
        entries.push([String(row.key), row.value as Record<string, RoomPhoto[]>])
        row.continue()
      }
      tx.oncomplete = () => resolve(Object.fromEntries(entries))
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Photo backup failed'))
    })
  } finally { db.close() }
}

export async function readPhotoEntries(): Promise<Record<string, Record<string, RoomPhoto[]>>> {
  return SERVER_MODE ? serverPhotoEntries() as Record<string, Record<string, RoomPhoto[]>> : readLocalPhotoEntries()
}

/** One IndexedDB transaction, also used to roll back an unsuccessful restore. */
export async function writePhotoEntries(entries: Record<string, Record<string, RoomPhoto[]> | null>): Promise<void> {
  if (SERVER_MODE) { stageRemotePhotoEntries(entries); return }
  if (typeof indexedDB === 'undefined') throw new Error('Photo storage is unavailable.')
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const [key, value] of Object.entries(entries)) {
        if (value === null) store.delete(key)
        else store.put(value, key)
      }
      tx.oncomplete = () => resolve()
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Photo restore failed'))
    })
  } finally { db.close() }
}

export async function saveRoomPhotos(
  quoteNo: string,
  roomPhotos: Record<string, RoomPhoto[]>,
  version = 1,
): Promise<void> {
  if (SERVER_MODE) return saveRemotePhotos(quoteNo, version, roomPhotos)
  if (typeof indexedDB === 'undefined') {
    if (Object.values(roomPhotos).some((photos) => photos.length > 0)) throw new Error('Photo storage is unavailable')
    return
  }
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(roomPhotos, photoKey(quoteNo, version))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Photo save aborted'))
    })
  } finally {
    db.close()
  }
}

export async function loadRoomPhotos(
  quoteNo: string,
  version = 1,
): Promise<Record<string, RoomPhoto[]> | null> {
  if (SERVER_MODE) return remotePhotos(quoteNo, version) as Record<string, RoomPhoto[]> | null
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  try {
    return await new Promise<Record<string, RoomPhoto[]> | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      tx.onabort = () => reject(tx.error ?? new Error('Photo load aborted'))
      const request = store.get(photoKey(quoteNo, version))
      request.onsuccess = () => {
        const value = request.result as Record<string, RoomPhoto[]> | undefined
        if (value) {
          resolve(value)
          return
        }
        if (Math.max(1, version || 1) !== 1) {
          resolve(null)
          return
        }
        const legacy = store.get(quoteNo)
        legacy.onsuccess = () => resolve((legacy.result as Record<string, RoomPhoto[]> | undefined) ?? null)
        legacy.onerror = () => reject(legacy.error)
      }
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function deleteRoomPhotos(quoteNo: string, version = 1): Promise<void> {
  if (SERVER_MODE) return saveRemotePhotos(quoteNo, version, null)
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.delete(photoKey(quoteNo, version))
      if (Math.max(1, version || 1) === 1) store.delete(quoteNo)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('Photo deletion aborted'))
    })
  } finally {
    db.close()
  }
}

/** Recover image bytes only for photos still present in the current draft. */
export function restoreRoomPhotoData(
  current: Record<string, RoomPhoto[]>,
  stored: Record<string, RoomPhoto[]> | null,
): Record<string, RoomPhoto[]> {
  const byId = new Map(Object.values(stored ?? {}).flat().map((photo) => [photo.id, photo]))
  return Object.fromEntries(Object.entries(current).map(([room, photos]) => [room, photos.map((photo) => ({
    ...photo,
    dataUrl: photo.dataUrl || byId.get(photo.id)?.dataUrl || '',
  }))]))
}
