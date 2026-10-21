import { useState } from 'react'
import { useAuth } from '../lib/authContext'
import { SERVER_MODE } from '../lib/apiClient'
import {
  legacyImportCount,
  importLegacyWorkspace,
  legacySettingsAvailable,
  importLegacySettings,
} from '../lib/serverWorkspace'
import { readLocalPhotoEntries } from '../lib/quotePhotoStore'
import { normalizeQuote } from '../lib/quoteContext'
export default function LegacyWorkspaceImport() {
  const { isAdmin } = useAuth()
  const [count] = useState(() => (SERVER_MODE ? legacyImportCount() : 0))
  const [hasSettings] = useState(() => SERVER_MODE && legacySettingsAvailable())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!SERVER_MODE || (!count && !hasSettings)) return null
  async function restore() {
    setBusy(true)
    setMessage('')
    try {
      const n = await importLegacyWorkspace(await readLocalPhotoEntries(), normalizeQuote)
      setMessage(
        `Imported ${n} quote versions and working copies. Existing shared records were preserved.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import browser data.')
    } finally {
      setBusy(false)
    }
  }
  async function restoreSettings() {
    setBusy(true)
    try {
      await importLegacySettings()
      setMessage('Previous company and price settings saved to the shared workspace.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import settings.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="quote-issued-banner">
      <p>{count} previous browser quote versions or drafts have been preserved separately.</p>
      {isAdmin ? (
        <>
          <button type="button" className="secondary-button" disabled={busy} onClick={restore}>
            {busy ? 'Importing…' : 'Import previous browser quotes'}
          </button>
          {hasSettings && (
            <p>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={restoreSettings}
              >
                Replace shared settings with previous browser settings
              </button>
            </p>
          )}
        </>
      ) : (
        <p>Sign in as an administrator in this browser to import them into the shared workspace.</p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  )
}
