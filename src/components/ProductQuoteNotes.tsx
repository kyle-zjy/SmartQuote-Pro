import { productTone, productWarrantyLabel, productWarrantyNote } from '../data/company'
import { useCompanySettings } from '../lib/companySettings'

export default function ProductQuoteNotes({ productKey }: { productKey: string }) {
  const { settings } = useCompanySettings()
  const tone = productTone(productKey)
  const warranty = productWarrantyNote(productKey)
  const warrantyLabel = productWarrantyLabel(productKey)
  const depositPercent = Math.round(settings.depositRate * 100)

  return (
    <aside className={`product-quote-notes product-tone product-tone--${tone}`}>
      <h2>Included on the quote</h2>
      <p className="muted small">These notes print on the quote with this product.</p>
      <ul>
        <li>Supply &amp; Install</li>
        <li>Frame Colour: enter colour</li>
        <li>List of items quoted</li>
        <li>**** TO PROCEED **** A minimum {depositPercent}% confirmed deposit is required of $XXXX</li>
        <li>{settings.licensing}</li>
        {warranty ? (
          <li className="product-tone-note">
            {warrantyLabel ? <span className="product-tone-badge">{warrantyLabel}</span> : null}
            {warranty}
          </li>
        ) : null}
        <li>**** Warranty and Care &amp; Maintenance details ****</li>
        <li>
          Warranty —{' '}
          <a href={settings.warrantyUrl} target="_blank" rel="noreferrer">
            {settings.warrantyUrl}
          </a>
        </li>
        <li>
          Care &amp; Maintenance —{' '}
          <a href={settings.careUrl} target="_blank" rel="noreferrer">
            {settings.careUrl}
          </a>
        </li>
      </ul>
    </aside>
  )
}
