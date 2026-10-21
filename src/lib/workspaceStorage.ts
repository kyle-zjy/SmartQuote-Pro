import { SERVER_MODE } from './apiClient'

export const CACHE_STATUS_EVENT = 'smartquote-pro:cache-status'
// Only failed persistence operations stay here. All consumers see the same current
// working copy, even if the browser can no longer write its persistent cache.
const pending = new Map<string, string | null>()
const remembered = new Map<string, string | null>()
let unavailable = false
function changed() {
  window.dispatchEvent(new Event(CACHE_STATUS_EVENT))
}
function failed() {
  if (!unavailable) {
    unavailable = true
    changed()
  }
}
export function browserCacheUnavailable() {
  return unavailable
}
function keys() {
  const result = new Set<string>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null) result.add(key)
    }
  } catch {
    failed()
    for (const [key, value] of remembered) if (value !== null) result.add(key)
  }
  for (const [key, value] of pending) {
    if (value === null) result.delete(key)
    else result.add(key)
  }
  return [...result]
}
export function retryBrowserCache() {
  for (const [key, value] of pending) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
      pending.delete(key)
    } catch {
      failed()
      return false
    }
  }
  try {
    const probe = 'smartquote-pro:cache-probe'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
  } catch {
    failed()
    return false
  }
  unavailable = false
  changed()
  return true
}

/** In server mode persistence is a cache; local-only mode retains strict writes. */
export const workspaceStorage: Storage = {
  get length() {
    return SERVER_MODE ? keys().length : localStorage.length
  },
  key(index) {
    return SERVER_MODE ? (keys()[index] ?? null) : localStorage.key(index)
  },
  getItem(key) {
    if (!SERVER_MODE) return localStorage.getItem(key)
    if (pending.has(key)) return pending.get(key) ?? null
    try {
      const value = localStorage.getItem(key)
      remembered.set(key, value)
      return value
    } catch {
      failed()
      return remembered.get(key) ?? null
    }
  },
  setItem(key, value) {
    if (!SERVER_MODE) return localStorage.setItem(key, value)
    remembered.set(key, value)
    try {
      localStorage.setItem(key, value)
      pending.delete(key)
    } catch {
      pending.set(key, value)
      failed()
    }
  },
  removeItem(key) {
    if (!SERVER_MODE) return localStorage.removeItem(key)
    remembered.set(key, null)
    try {
      localStorage.removeItem(key)
      pending.delete(key)
    } catch {
      pending.set(key, null)
      failed()
    }
  },
  clear() {
    if (!SERVER_MODE) return localStorage.clear()
    // Do not clear unrelated origin data.
    for (const key of keys()) if (key.startsWith('smartquote-pro:')) this.removeItem(key)
  },
}
