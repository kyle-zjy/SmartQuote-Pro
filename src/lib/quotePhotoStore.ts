import type { RoomPhoto } from './quoteContext'

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
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function photoKey(quoteNo: string, version: number): string {
  return `${quoteNo}:v${Math.max(1, version || 1)}`
}

export async function saveRoomPhotos(
  quoteNo: string,
  roomPhotos: Record<string, RoomPhoto[]>,
  version = 1,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(roomPhotos, photoKey(quoteNo, version))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadRoomPhotos(
  quoteNo: string,
  version = 1,
): Promise<Record<string, RoomPhoto[]> | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
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
}

export async function deleteRoomPhotos(quoteNo: string, version = 1): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.delete(photoKey(quoteNo, version))
    if (Math.max(1, version || 1) === 1) store.delete(quoteNo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
