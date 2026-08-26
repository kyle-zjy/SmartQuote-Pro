import { useNavigate } from 'react-router-dom'
import { displayQuoteNo } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'
import { useQuote } from '../lib/quoteContext'

function formatSavedDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export default function SavedQuotes() {
  const navigate = useNavigate()
  const { items, customer, quoteNo, savedQuotes, loadSavedQuote, deleteSavedQuote } = useQuote()
  const hasDraft = items.length > 0 || Boolean(customer.name.trim())

  function handleOpen(savedQuoteNo: string) {
    if (savedQuoteNo !== quoteNo && hasDraft) {
      const ok = window.confirm(
        'Open this saved quote? The quote you are editing now will be replaced. Save it first if you still need it.',
      )
      if (!ok) return
    }
    if (!loadSavedQuote(savedQuoteNo)) return
    navigate('/quote')
  }

  function handleDelete(savedQuoteNo: string, label: string) {
    if (!window.confirm(`Delete saved quote ${label}? This cannot be undone.`)) return
    deleteSavedQuote(savedQuoteNo)
  }

  return (
    <div>
      <h1>Saved quotes</h1>
      <p className="muted">
        Quotes saved on this browser. Opening one loads it into the editor so you can keep working or export a PDF
        again.
      </p>

      {savedQuotes.length === 0 ? (
        <p className="muted">No saved quotes yet. Open a quote and choose Save quote.</p>
      ) : (
        <table className="quote-table saved-quotes">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {savedQuotes.map((record) => {
              const label = displayQuoteNo(record.quote.quoteNo, record.quote.quoteSuffix)
              return (
                <tr key={record.quoteNo}>
                  <td>
                    {label}
                    {record.quote.status === 'issued' ? <span className="muted small"> (issued)</span> : null}
                    {record.quoteNo === quoteNo ? <span className="muted small"> (open)</span> : null}
                  </td>
                  <td>{record.quote.customer.name || '—'}</td>
                  <td>{formatSavedDate(record.quote.quoteDate)}</td>
                  <td>{formatCurrency(record.total)}</td>
                  <td className="saved-quotes__actions">
                    <button type="button" className="link-button" onClick={() => handleOpen(record.quoteNo)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleDelete(record.quoteNo, label)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
