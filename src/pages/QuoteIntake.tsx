import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'
import { formatPhone } from '../lib/phoneFormat'
import { isValidQuoteNumber } from '../lib/quoteNumberValidation'
import QuoteAddresses from '../components/QuoteAddresses'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function QuoteIntake() {
  const { items, customer, newQuote, setCustomer, setShipTo, setShipSameAsBill, setQuoteDate } = useQuote()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [sameAddress, setSameAddress] = useState(true)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [error, setError] = useState('')
  const [date, setDate] = useState(todayISO())

  function handleCreate() {
    if (quoteNumber.trim() && !isValidQuoteNumber(quoteNumber.trim())) {
      setError('Enter a quote number with up to 50 letters and numbers.')
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
    setCustomer({ name, address: sameAddress ? siteAddress : billingAddress, phone, email: email.trim() })
    setShipTo({ name, address: siteAddress, phone, email: email.trim() })
    setShipSameAsBill(sameAddress)
    setQuoteDate(date)
    navigate(`/quotes/${quoteNo}`)
  }

  return (
    <form className="quote-editor quote-intake" onSubmit={(event) => { event.preventDefault(); handleCreate() }}>
      <p>
        <Link to="/quotes">&larr; All quotes</Link>
      </p>
      <h1>New quote</h1>
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
          Email addresses
          <input type="email" multiple aria-label="Email addresses" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com, accounts@example.com" />
          <span className="muted small">Separate multiple email addresses with commas.</span>
        </label>
        <QuoteAddresses siteAddress={siteAddress} billingAddress={billingAddress} same={sameAddress}
          onSiteChange={setSiteAddress} onBillingChange={setBillingAddress} onSameChange={setSameAddress} />
        <label>
          Quote date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Quote number
          <input value={quoteNumber} onChange={(e) => { setQuoteNumber(e.target.value); setError('') }} placeholder="e.g. A123" />
          <span className="muted small">Enter your quote number, or leave blank to generate the next one.</span>
        </label>
      </div>
      {error && <p className="price-result--error" role="alert">{error}</p>}
      <div className="quote-actions">
        <button type="submit" className="primary-button">
          Start quote
        </button>
      </div>
    </form>
  )
}
