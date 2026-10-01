export default function QuoteAddresses({
  siteAddress, billingAddress, same, disabled = false, onSiteChange, onBillingChange, onSameChange,
}: {
  siteAddress: string
  billingAddress: string
  same: boolean
  disabled?: boolean
  onSiteChange: (address: string) => void
  onBillingChange: (address: string) => void
  onSameChange?: (same: boolean) => void
}) {
  return (
    <>
      <label className="quote-editor__wide">
        Site address
        <textarea aria-label="Site address" value={siteAddress} onChange={(e) => onSiteChange(e.target.value)}
          placeholder={'Street\nSuburb STATE'} rows={3} disabled={disabled} />
      </label>
      {onSameChange && (
        <label className="checkbox-row quote-editor__wide">
          <input type="checkbox" checked={same} onChange={(e) => onSameChange(e.target.checked)} disabled={disabled} />
          Billing address is the same as site address
        </label>
      )}
      <label className="quote-editor__wide">
        Billing address
        <textarea aria-label="Billing address" value={same ? siteAddress : billingAddress} onChange={(e) => onBillingChange(e.target.value)}
          placeholder={'Street\nSuburb STATE'} rows={3} disabled={disabled || same} />
      </label>
    </>
  )
}
