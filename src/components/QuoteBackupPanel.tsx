import { workspaceStorage } from '../lib/workspaceStorage'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createQuoteBackup, localQuoteDrafts, parseQuoteBackup, planQuoteRestore, restoreQuoteBackup, type QuoteBackup } from '../lib/quoteBackup'
import { useQuote } from '../lib/quoteContext'
import { ARCHIVE_KEY } from '../lib/quoteArchive'
import { useAuth } from '../lib/authContext'
import { SERVER_DATA_EVENT, SERVER_MODE } from '../lib/apiClient'
import { useEffect } from 'react'

export default function QuoteBackupPanel() {
  const quote = useQuote()
  const {isAdmin} = useAuth()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [backup, setBackup] = useState<QuoteBackup | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState(() => {
    try { return localQuoteDrafts() } catch { return [] }
  })
  const plan = (() => { try { return backup ? planQuoteRestore(backup) : null } catch { return null } })()
  useEffect(()=>{const refresh=()=>{try{setDrafts(localQuoteDrafts())}catch{/* Keep the displayed drafts. */}};window.addEventListener(SERVER_DATA_EVENT,refresh);return ()=>window.removeEventListener(SERVER_DATA_EVENT,refresh)},[])

  async function exportBackup() {
    setBusy(true)
    setMessage('')
    try {
      const data = await createQuoteBackup(quote.canEdit ? quote : undefined)
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `smartquote-backup-${data.createdAt.replace(/[:.]/g, '-')}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMessage(`Backup downloaded: ${data.archives.length} saved versions and ${data.drafts.length} drafts, including available photos and review records.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create a complete backup.') }
    finally { setBusy(false) }
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMessage('')
    setBackup(null)
    try {
      const data = parseQuoteBackup(await file.text())
      planQuoteRestore(data)
      setBackup(data)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read this backup.') }
    finally { setBusy(false) }
  }

  async function restore() {
    if (!backup) return
    setBusy(true)
    try {
      const result = await restoreQuoteBackup(backup, quote.ownsQuoteEditing)
      if (!quote.items.length && !quote.customer.name.trim()) {
        if (result.drafts.some((draft) => draft.quoteNo === quote.quoteNo && draft.version === quote.version)) quote.loadDraftQuote(quote.quoteNo, quote.version)
        else if (result.archives.some((record) => record.quoteNo === quote.quoteNo && record.version === quote.version)) quote.loadSavedQuote(quote.quoteNo, quote.version)
      }
      quote.refreshSavedQuotes()
      setDrafts(localQuoteDrafts())
      setMessage(`Restored ${result.archives.length} saved versions and ${result.drafts.length} drafts. Skipped ${result.skipped} existing versions or drafts.`)
      setBackup(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Restore failed. Your existing quotes were preserved.') }
    finally { setBusy(false) }
  }

  return <details className="admin-panel">
    <summary>{SERVER_MODE ? 'Backup, restore & shared drafts' : 'Backup, restore & local drafts'}</summary>
    {quote.archiveStorageError && <button type="button" className="secondary-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([workspaceStorage.getItem(ARCHIVE_KEY) ?? ''], { type: 'text/plain' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'smartquote-archive-recovery.txt'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }}>Download raw archive recovery copy</button>}
    <p className="muted small">Download saved quotes, local drafts, unfinished openings, review records and available photos. Login accounts and passwords are excluded. Restoring adds missing versions and drafts; existing copies are kept.</p>
    <div className="quote-actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={exportBackup}>Download quote backup</button>
      <button type="button" className="secondary-button" disabled={busy || (SERVER_MODE && !isAdmin)} onClick={() => input.current?.click()}>Choose backup to restore</button>
      <input ref={input} type="file" accept="application/json,.json" aria-label="Quote backup file" hidden onChange={(event) => {
        void importFile(event.target.files?.[0])
        event.target.value = ''
      }} />
    </div>
    {backup && plan && <section aria-label="Backup restore preview">
      <p>Backup created {new Date(backup.createdAt).toLocaleString('en-AU')}.</p>
      <p>{plan.archives.length} saved versions and {plan.drafts.length} drafts will be added. {plan.skipped} existing versions or drafts will be skipped.</p>
      <p className="muted small">Close other tabs editing the quotes being restored before continuing.</p>
      <button type="button" className="primary-button" disabled={busy} onClick={restore}>Restore missing quotes and drafts</button>{' '}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => setBackup(null)}>Cancel restore</button>
    </section>}
    {message && <p role="status">{message}</p>}
    {drafts.length > 0 && <section aria-label="Local quote drafts">
      <h3>{SERVER_MODE ? 'Shared drafts and local working copies' : 'Local drafts'}</h3>
      <ul>{drafts.map((draft) => <li key={JSON.stringify([draft.quoteNo, draft.version])}>
        Quote {draft.quoteNo} · Rev {draft.version} — {draft.customer.name || 'No customer'}{' '}
        <button type="button" className="link-button" disabled={busy} onClick={() => {
          if (quote.items.length && !window.confirm('Open this local draft? Current edits will remain in this browser’s draft storage.')) return
          if (quote.loadDraftQuote(draft.quoteNo, draft.version)) navigate(`/quotes/${encodeURIComponent(draft.quoteNo)}`)
        }}>Open draft {draft.quoteNo} revision {draft.version}</button>
      </li>)}</ul>
    </section>}
  </details>
}
