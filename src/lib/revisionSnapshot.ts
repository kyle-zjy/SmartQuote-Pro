import pricing from '../data/pricing.json'
import type { QuoteLineItem, RoomPhoto } from './quoteContext'

const PRODUCT_NAMES: Record<string, string> = Object.fromEntries(
  pricing.products.map((product) => [product.key, product.name]),
)

export function normalizeSnapshotRoom(room: string | undefined): string {
  return room?.trim() ? room.trim() : 'Unassigned'
}

function photosById(photos: RoomPhoto[]): Map<string, RoomPhoto> {
  const byId = new Map<string, RoomPhoto>()
  for (const photo of photos) byId.set(photo.id, photo)
  return byId
}

export function mergeRoomPhotos(
  archived: Record<string, RoomPhoto[]>,
  stored: Record<string, RoomPhoto[]> | null | undefined,
): Record<string, RoomPhoto[]> {
  const rooms = new Set<string>()
  for (const room of Object.keys(archived)) rooms.add(normalizeSnapshotRoom(room))
  for (const room of Object.keys(stored ?? {})) rooms.add(normalizeSnapshotRoom(room))

  const merged: Record<string, RoomPhoto[]> = {}
  for (const room of rooms) {
    const byId = photosById([
      ...(archived[room] ?? []),
      ...(archived[room === 'Unassigned' ? '' : room] ?? []),
    ])
    for (const photo of [
      ...(stored?.[room] ?? []),
      ...(stored?.[room === 'Unassigned' ? '' : room] ?? []),
    ]) {
      const existing = byId.get(photo.id)
      if (!existing) {
        byId.set(photo.id, photo)
        continue
      }
      byId.set(photo.id, {
        id: photo.id,
        caption: existing.caption || photo.caption,
        dataUrl: photo.dataUrl || existing.dataUrl,
      })
    }
    merged[room] = [...byId.values()]
  }
  return merged
}

export function snapshotRooms(
  items: Array<Pick<QuoteLineItem, 'room'>>,
  roomPhotos: Record<string, RoomPhoto[]>,
): string[] {
  const rooms: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const room = normalizeSnapshotRoom(item.room)
    if (seen.has(room)) continue
    seen.add(room)
    rooms.push(room)
  }
  for (const room of Object.keys(roomPhotos)) {
    const label = normalizeSnapshotRoom(room)
    if (seen.has(label) || (roomPhotos[room] ?? []).length === 0) continue
    seen.add(label)
    rooms.push(label)
  }
  return rooms
}

export function photosForRoom(roomPhotos: Record<string, RoomPhoto[]>, room: string): RoomPhoto[] {
  const label = normalizeSnapshotRoom(room)
  if (label === 'Unassigned') {
    const byId = photosById([...(roomPhotos.Unassigned ?? []), ...(roomPhotos[''] ?? [])])
    return [...byId.values()]
  }
  return roomPhotos[label] ?? []
}

export function countSnapshotPhotos(roomPhotos: Record<string, RoomPhoto[]>): {
  total: number
  withImage: number
} {
  let total = 0
  let withImage = 0
  for (const photos of Object.values(roomPhotos)) {
    for (const photo of photos) {
      total += 1
      if (photo.dataUrl) withImage += 1
    }
  }
  return { total, withImage }
}

export function snapshotProductName(productKey: string | undefined): string {
  if (!productKey) return 'Add-on / other'
  return PRODUCT_NAMES[productKey] ?? productKey
}

export function formatSnapshotDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export function formatSnapshotDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function adjacentRevisions<T extends { version: number }>(
  versions: T[],
  currentVersion: number,
): { older: T | undefined; newer: T | undefined } {
  const sorted = [...versions].sort((a, b) => a.version - b.version)
  const index = sorted.findIndex((record) => record.version === currentVersion)
  if (index < 0) return { older: undefined, newer: undefined }
  return {
    older: sorted[index - 1],
    newer: sorted[index + 1],
  }
}
