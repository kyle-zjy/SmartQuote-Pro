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

export async function saveRoomPhotos(quoteNo: string, roomPhotos: Record<string, RoomPhoto[]>): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(roomPhotos, quoteNo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadRoomPhotos(quoteNo: string): Promise<Record<string, RoomPhoto[]> | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(quoteNo)
    request.onsuccess = () => {
      const value = request.result as Record<string, RoomPhoto[]> | undefined
      resolve(value ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function deleteRoomPhotos(quoteNo: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(quoteNo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
