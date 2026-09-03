import { useState } from 'react'
import { COMPANY, type CompanySettings } from '../data/company'
import { useCompanySettings } from '../lib/companySettings'

export default function AdminCompany() {
  const { settings, setSettings, resetSettings } = useCompanySettings()
  const [draft, setDraft] = useState<CompanySettings>(settings)
  const [saved, setSaved] = useState(false)

  function update<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function handleSave() {
    setSettings(draft)
    setSaved(true)
  }

  function handleReset() {
    if (!window.confirm('Reset company details to the Goldco defaults?')) return
    resetSettings()
    setDraft(COMPANY)
    setSaved(true)
  }

  return (
    <div className="admin-form">
      <h2>Company</h2>
      <label>
        Name
        <input value={draft.name} onChange={(e) => update('name', e.target.value)} />
      </label>
      <div className="field-row">
        <label>
          ABN
          <input value={draft.abn} onChange={(e) => update('abn', e.target.value)} />
        </label>
        <label>
          QBCC
          <input value={draft.qbcc} onChange={(e) => update('qbcc', e.target.value)} />
        </label>
      </div>
      <label>
        Address
        <input value={draft.address} onChange={(e) => update('address', e.target.value)} />
      </label>
      <label>
        Phone
        <input value={draft.phone} onChange={(e) => update('phone', e.target.value)} />
      </label>

      <h2>Bank</h2>
      <label>
        Bank name
        <input value={draft.bank.name} onChange={(e) => update('bank', { ...draft.bank, name: e.target.value })} />
      </label>
      <div className="field-row">
        <label>
          BSB
          <input value={draft.bank.bsb} onChange={(e) => update('bank', { ...draft.bank, bsb: e.target.value })} />
        </label>
        <label>
          Account
          <input
            value={draft.bank.account}
            onChange={(e) => update('bank', { ...draft.bank, account: e.target.value })}
          />
        </label>
      </div>

      <h2>Quote defaults</h2>
      <div className="field-row">
        <label>
          Validity (days)
          <input
            type="number"
            min={1}
            value={draft.validityDays}
            onChange={(e) => update('validityDays', Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Deposit rate
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={draft.depositRate}
            onChange={(e) => update('depositRate', Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Card fee %
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft.cardFeePercent}
            onChange={(e) => update('cardFeePercent', Number(e.target.value) || 0)}
          />
        </label>
        <label>
          Non-standard colour $
          <input
            type="number"
            min={0}
            step={1}
            value={draft.nonStandardColourPrice}
            onChange={(e) => update('nonStandardColourPrice', Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <h2>Terms &amp; links</h2>
      <label>
        Terms document
        <input value={draft.termsNote} onChange={(e) => update('termsNote', e.target.value)} />
      </label>
      <label>
        Contract text
        <textarea rows={4} value={draft.termsContract} onChange={(e) => update('termsContract', e.target.value)} />
      </label>
      <label>
        Size disclaimer
        <textarea rows={2} value={draft.sizeDisclaimer} onChange={(e) => update('sizeDisclaimer', e.target.value)} />
      </label>
      <label>
        Licensing note
        <textarea rows={3} value={draft.licensing} onChange={(e) => update('licensing', e.target.value)} />
      </label>
      <label>
        Warranty URL
        <input value={draft.warrantyUrl} onChange={(e) => update('warrantyUrl', e.target.value)} />
      </label>
      <label>
        Care URL
        <input value={draft.careUrl} onChange={(e) => update('careUrl', e.target.value)} />
      </label>

      <div className="quote-actions">
        <button type="button" className="primary-button" onClick={handleSave}>
          Save settings
        </button>
        <button type="button" className="secondary-button" onClick={handleReset}>
          Reset defaults
        </button>
        {saved && <span className="muted small">Saved on this browser.</span>}
      </div>
    </div>
  )
}
