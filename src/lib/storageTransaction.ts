/** Best-effort rollback for related localStorage writes in this browser prototype. */
export function withStorageRollback<T>(storage: Storage, keys: string[], write: () => T): T {
  const before = keys.map((key) => [key, storage.getItem(key)] as const)
  try {
    return write()
  } catch (error) {
    for (const [key, value] of before) {
      try {
        if (storage.getItem(key) === value) continue
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch {
        // Storage may have become unavailable entirely; still report the original failure.
      }
    }
    throw error
  }
}
