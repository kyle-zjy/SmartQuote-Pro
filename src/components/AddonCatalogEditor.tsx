import { useState, type FormEvent } from 'react'
import { usePricing } from '../lib/pricingContext'
import { formatCurrency } from '../lib/formatCurrency'
import type { AddonItem } from '../types/pricing'

export default function AddonCatalogEditor() {
  const { addons, saveAddons } = usePricing()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [section, setSection] = useState('Door hardware')
  const [price, setPrice] = useState('')
  const [onRequest, setOnRequest] = useState(false)
  const [unit, setUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function clear() {
    setEditing(null); setName(''); setPrice(''); setUnit(''); setOnRequest(false)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(''); setMessage('')
    if (!onRequest && !price.trim()) { setError('Enter a price, including 0 for a free item.'); return }
    if (addons.some((item) => item.name !== editing && item.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setError('An add-on with this name already exists.'); return
    }
    if (editing && !addons.some((item) => item.name === editing)) {
      setError('This add-on was removed. Cancel and add it again if needed.'); return
    }
    const item: AddonItem = { name: name.trim(), section: section.trim() || 'Other', price: onRequest ? null : Number(price), priceOnRequest: onRequest, unit: unit.trim() || null }
    setBusy(true)
    try {
      await saveAddons(editing ? addons.map((old) => old.name === editing ? item : old) : [...addons, item])
      clear(); setMessage('Add-on saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save add-on.') }
    finally { setBusy(false) }
  }

  async function remove(item: AddonItem) {
    setBusy(true); setError(''); setMessage('')
    try {
      await saveAddons(addons.filter((old) => old.name !== item.name))
      if (editing === item.name) clear()
      setMessage('Add-on removed. Existing quote charges are preserved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove add-on.') }
    finally { setBusy(false) }
  }

  return (
    <section aria-label="Add-on catalog">
      <h2>Manage add-ons</h2>
      <p className="muted small">Add or edit items for future quotes. Use the Extras category for repairs; other categories appear on new products. Existing quotes keep their saved names and prices. Importing a price list or restoring defaults may replace this catalog.</p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>{editing ? `Edit ${editing}` : 'New add-on'}</legend>
          <div className="field-row">
            <label>Item name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Category<input required list="addon-categories" value={section} onChange={(event) => setSection(event.target.value)} /></label>
            <datalist id="addon-categories">{[...new Set(['Extras', 'Door hardware', ...addons.map((item) => item.section || 'Other')])].map((value) => <option key={value} value={value} />)}</datalist>
          </div>
          <div className="field-row">
            <label>Price ($)<input type="number" min="0" step="0.01" required={!onRequest} disabled={onRequest} value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label>Unit (optional)<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. each" /></label>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={onRequest} onChange={(event) => setOnRequest(event.target.checked)} />Price on request</label>
          <div className="quote-actions">
            <button type="submit" className="primary-button">{editing ? 'Save add-on' : 'Add add-on'}</button>
            {editing && <button type="button" className="secondary-button" onClick={clear}>Cancel edit</button>}
          </div>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <table className="quote-table">
        <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Actions</th></tr></thead>
        <tbody>{addons.map((item) => <tr key={item.name}>
          <td>{item.name}{item.unit && ` (${item.unit})`}</td><td>{item.section}</td>
          <td>{item.priceOnRequest ? 'Price on request' : formatCurrency(item.price ?? 0)}</td>
          <td>
            <button type="button" className="link-button" disabled={busy} aria-label={`Edit ${item.name}`} onClick={() => {
              setEditing(item.name); setName(item.name); setSection(item.section || 'Other'); setPrice(item.price === null ? '' : String(item.price)); setOnRequest(item.priceOnRequest); setUnit(item.unit || ''); setError(''); setMessage('')
            }}>Edit</button>{' '}
            <button type="button" className="link-button" disabled={busy} aria-label={`Delete ${item.name}`} onClick={() => void remove(item)}>Delete</button>
          </td>
        </tr>)}</tbody>
      </table>
    </section>
  )
}
