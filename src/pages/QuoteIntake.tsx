import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function QuoteIntake() {
  const { items, customer, newQuote, setCustomer, setQuoteDate } = useQuote()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(todayISO())

  function handleCreate() {
    const hasDraft = items.length > 0 || Boolean(customer.name.trim())
    if (
      hasDraft &&
      !window.confirm(
        'Start a new quote? The current quote on this browser will be replaced. Save it first if you still need it.',
      )
    ) {
      return
    }

    const quoteNo = newQuote()
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
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04xx xxx xxx" />
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
      </div>
      <div className="quote-actions">
        <button type="button" className="primary-button" onClick={handleCreate}>
          Start quote
        </button>
      </div>
    </div>
  )
}
