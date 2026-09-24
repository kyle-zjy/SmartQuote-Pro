import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'
import { formatPhone } from '../lib/phoneFormat'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function QuoteIntake() {
  const { items, customer, newQuote, setCustomer, setQuoteDate } = useQuote()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [error, setError] = useState('')
  const [date, setDate] = useState(todayISO())

  function handleCreate() {
    if (quoteNumber.trim() && !/^\d{1,8}$/.test(quoteNumber.trim())) {
      setError('Enter a quote number with up to 8 digits.')
      return
    }
    const hasDraft = items.length > 0 || Boolean(customer.name.trim())
    if (
      hasDraft &&
      !window.confirm(
        'Start a new quote? The current quote on this browser will be replaced. Save it first if you still need it.',
      )
    ) {
      return
    }

    const quoteNo = newQuote(quoteNumber.trim() || undefined)
    if (!quoteNo) {
      setError('This quote number is already in use. Enter another number or leave it blank to generate one.')
      return
    }
    setCustomer({ name, address, phone })
    setQuoteDate(date)
    navigate(`/quotes/${quoteNo}`)
  }

  return (
    <div className="quote-editor quote-intake">
      <p>
        <Link to="/quotes">&larr; All quotes</Link>
      </p>
      <h1>New quote</h1>
      <p className="muted">Customer details can be finished later — start with whatever you have on site.</p>
      <div className="quote-editor__grid">
        <label>
          Customer
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="0417-001-615" />
        </label>
        <label className="quote-editor__wide">
          Address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={'Street\nSuburb STATE'}
            rows={3}
          />
        </label>
        <label>
          Quote date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Quote number
          <input inputMode="numeric" value={quoteNumber} onChange={(e) => { setQuoteNumber(e.target.value); setError('') }} placeholder="e.g. 33021" />
          <span className="muted small">Enter your quote number, or leave blank to generate the next one.</span>
        </label>
      </div>
      {error && <p className="price-result--error" role="alert">{error}</p>}
      <div className="quote-actions">
        <button type="button" className="primary-button" onClick={handleCreate}>
          Start quote
        </button>
      </div>
    </div>
  )
}
