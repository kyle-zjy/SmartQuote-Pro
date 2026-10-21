import { useCallback, useEffect, useRef, useState } from 'react'
import { remoteStorageTransaction } from './serverWorkspace'

export const QUOTE_WRITE_LOCK = 'smartquote-pro:quote-storage-write'
export const quoteEditLockName = (quoteNo: string) => `smartquote-pro:editing:${encodeURIComponent(quoteNo)}`

export async function withQuoteStorageLock<T>(write: () => T | Promise<T>, importing = false): Promise<T> {
  if (typeof window === 'undefined') return write()
  if (!navigator.locks) throw new Error('Protected quote editing requires a browser with Web Locks support.')
  return navigator.locks.request(QUOTE_WRITE_LOCK, () => remoteStorageTransaction(write, importing))
}

export async function withQuoteWriteAccess<T>(quoteNo: string, owns: (no: string) => boolean, write: () => T): Promise<T> {
  if (owns(quoteNo)) return withQuoteStorageLock(() => {
    if (!owns(quoteNo)) throw new Error('This tab no longer has editing access. Reopen the quote before saving.')
    return write()
  })
  if (!navigator.locks) throw new Error('Protected quote editing is unavailable in this browser.')
  return navigator.locks.request(quoteEditLockName(quoteNo), { ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error('This quote is being edited in another tab. Close it there before changing this saved quote.')
    return withQuoteStorageLock(write)
  })
}

/** Browser-owned locks disappear when a tab closes; no stale timeout or takeover can discard edits. */
export function useQuoteEditLock(quoteNo: string) {
  const held = useRef<string | null>(null)
  const [result, setResult] = useState<{ no: string; allowed: boolean; pending: boolean }>({ no: '', allowed: false, pending: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let release: (() => void) | undefined
    setResult({ no: quoteNo, allowed: false, pending: true })
    if (!navigator.locks) {
      setResult({ no: quoteNo, allowed: false, pending: false })
      return
    }
    const timer = window.setTimeout(() => {
      void navigator.locks.request(quoteEditLockName(quoteNo), { ifAvailable: true }, async (lock) => {
        if (cancelled) return
        if (!lock) {
          setResult({ no: quoteNo, allowed: false, pending: false })
          return
        }
        held.current = quoteNo
        setResult({ no: quoteNo, allowed: true, pending: false })
        await new Promise<void>((resolve) => { release = resolve })
      }).catch(() => {
        if (!cancelled) setResult({ no: quoteNo, allowed: false, pending: false })
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (held.current === quoteNo) held.current = null
      release?.()
    }
  }, [quoteNo, attempt])
  const owns = useCallback((no: string) => held.current === no, [])
  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return {
    canEdit: result.no === quoteNo && result.allowed,
    pending: result.no !== quoteNo || result.pending,
    owns,
    retry,
  }
}
