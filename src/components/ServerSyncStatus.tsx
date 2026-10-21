import { useEffect, useState } from 'react'
import { SERVER_MODE, SYNC_STATUS_EVENT } from '../lib/apiClient'
import { getSyncError } from '../lib/serverWorkspace'
import { useQuote } from '../lib/quoteContext'
import {
  browserCacheUnavailable,
  CACHE_STATUS_EVENT,
  retryBrowserCache,
} from '../lib/workspaceStorage'
export default function ServerSyncStatus() {
  const quote = useQuote()
  const [error, setError] = useState(getSyncError)
  const [cacheWarning, setCacheWarning] = useState(browserCacheUnavailable)
  useEffect(() => {
    const refresh = () => setError(getSyncError())
    window.addEventListener(SYNC_STATUS_EVENT, refresh)
    return () => window.removeEventListener(SYNC_STATUS_EVENT, refresh)
  }, [])
  useEffect(() => {
    const refresh = () => setCacheWarning(browserCacheUnavailable())
    window.addEventListener(CACHE_STATUS_EVENT, refresh)
    return () => window.removeEventListener(CACHE_STATUS_EVENT, refresh)
  }, [])
  if (!SERVER_MODE || (!error && !cacheWarning)) return null
  return (
    <>
      {cacheWarning && (
        <div className="quote-issued-banner" role="status">
          <p>
            Browser cache is unavailable. Saves confirmed by the server are safe. Edits not yet saved
            to the server may be lost if you close or reload this page.
          </p>
          <button type="button" className="secondary-button" onClick={retryBrowserCache}>
            Retry browser cache
          </button>
        </div>
      )}
      {error && (
        <div className="quote-issued-banner" role="alert">
          <p>{error}</p>
          <p>
            {cacheWarning
              ? 'Keep this page open and download a backup of unsaved edits.'
              : 'Your working copy is kept in this browser. Save a backup before replacing edits.'}
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (
                window.confirm(
                  'Load the shared quote and replace the current working copy? Download a backup first if you need these edits.',
                )
              )
                void quote.retryEditing()
            }}
          >
            Reload shared quote
          </button>
        </div>
      )}
    </>
  )
}
