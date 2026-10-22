import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'
import { formatPhone } from '../lib/phoneFormat'
import { isValidQuoteNumber } from '../lib/quoteNumberValidation'
import QuoteAddresses from '../components/QuoteAddresses'
import QuoteDiscountFields from '../components/QuoteDiscountFields'
import type { QuoteDiscount } from '../lib/quoteDiscount'
import CustomerNameFields from '../components/CustomerNameFields'
import { useAuth } from '../lib/authContext'
import { recordQuoteOwner } from '../lib/reviewStore'
import { withQuoteStorageLock } from '../lib/quoteWriteLock'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function QuoteIntake() {
  const { items, customer, newQuote, setCustomer, setShipTo, setShipSameAsBill, setQuoteDate, setDiscount } = useQuote()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [sameAddress, setSameAddress] = useState(true)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quoteNumber, setQuoteNumber] = useState('')
  const [error, setError] = useState('')
  const [date, setDate] = useState(todayISO())
  const [discount, setDraftDiscount] = useState<QuoteDiscount>()
  const [discountValid, setDiscountValid] = useState(true)

  async function handleCreate() {
    if (!discountValid) return
    if (quoteNumber.trim() && !isValidQuoteNumber(quoteNumber.trim())) {
      setError('Enter a quote number with up to 50 characters. Any characters are allowed.')
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

    let quoteNo: string | null
    try { quoteNo = await newQuote(quoteNumber.trim() || undefined) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not create this quote.'); return }
    if (!quoteNo) {
      setError('This quote number is already in use. Enter another number or leave it blank to generate one.')
      return
    }
    const names = { firstName: firstName.trim(), surname: surname.trim(), name: [firstName.trim(), surname.trim()].filter(Boolean).join(' ') }
    setCustomer({ ...names, address: sameAddress ? siteAddress : billingAddress, phone, email: email.trim() })
    setShipTo({ ...names, address: siteAddress, phone, email: email.trim() })
    setShipSameAsBill(sameAddress)
    setQuoteDate(date)
    if (discount) setDiscount(discount)
    if (user) {
      try {
        await withQuoteStorageLock(() => recordQuoteOwner(quoteNo!, user.id))
      } catch {
        // Ownership tracking is best-effort.
      }
    }
    navigate(`/quotes/${encodeURIComponent(quoteNo ?? "")}`)
  }

  return (
    <form className="quote-editor quote-intake" onSubmit={(event) => { event.preventDefault(); handleCreate() }}>
      <p>
        <Link to="/quotes">&larr; All quotes</Link>
      </p>
      <h1>New quote</h1>
      <div className="quote-editor__grid">
        <CustomerNameFields firstName={firstName} surname={surname}
          onChange={(first, last) => { setFirstName(first); setSurname(last) }} />
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
          <span className="muted small">Use any characters (up to 50), or leave blank to generate the next number.</span>
        </label>
        <QuoteDiscountFields value={discount} onChange={setDraftDiscount} onValidityChange={setDiscountValid} />
      </div>
      {error && <p className="price-result--error" role="alert">{error}</p>}
      <div className="quote-actions">
        <button type="submit" className="primary-button" disabled={!discountValid}>
          Start quote
        </button>
      </div>
    </form>
  )
}
