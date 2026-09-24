import { useEffect, useRef, useState } from 'react'
import { exportElementToPdf, quotePdfFilename } from '../lib/exportQuotePdf'
import { displayQuoteNo } from '../lib/displayQuoteNo'
import { useQuote } from '../lib/quoteContext'
import QuoteDocument from './QuoteDocument'

export default function QuotePdfPreview({ onClose }: { onClose: () => void }) {
  const { quoteNo, quoteNumber, customer } = useQuote()
  const paperRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, saving])

  async function handleDownload() {
    if (!paperRef.current || saving) return
    setSaving(true)
    setError(null)
    try {
      await exportElementToPdf(paperRef.current, quotePdfFilename(displayQuoteNo(quoteNo, quoteNumber), customer.name))
      onClose()
    } catch {
      setError('Could not create the PDF. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quote-preview-overlay" onClick={() => !saving && onClose()}>
      <div
        className="quote-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="quote-preview__header">
          <div>
            <h2 id="quote-preview-title">Preview quote</h2>
            <p className="muted small">Check the quote below, then download it as a PDF.</p>
          </div>
          <button type="button" className="link-button" onClick={onClose} disabled={saving}>
            Close
          </button>
        </header>

        <div className="quote-preview__body">
          <div ref={paperRef} className="quote-paper quote-paper--preview">
            <QuoteDocument readOnly />
          </div>
        </div>

        <footer className="quote-preview__footer">
          {error && <p className="quote-preview__error">{error}</p>}
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Back
          </button>
          <button type="button" className="primary-button" onClick={() => void handleDownload()} disabled={saving}>
            {saving ? 'Creating PDF…' : 'Download PDF'}
          </button>
        </footer>
      </div>
    </div>
  )
}
