import { useEffect, useState } from 'react'
import { isValidDiscountPercent, type QuoteDiscount } from '../lib/quoteDiscount'

export default function QuoteDiscountFields({ value, onChange, onValidityChange, disabled = false }: {
  value?: QuoteDiscount
  onChange: (discount: QuoteDiscount) => void
  onValidityChange: (valid: boolean) => void
  disabled?: boolean
}) {
  const percent = value?.percent ?? 0
  const [text, setText] = useState(String(percent))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => {
    setText((current) => Number(current) === percent ? current : String(percent))
    setInvalid(false)
    onValidityChange(true)
  }, [percent, onValidityChange])

  return <>
    <label>
      Discount (%)
      <input type="number" min={0} max={100} step="any" aria-label="Discount (%)"
        value={text} disabled={disabled} aria-invalid={invalid}
        onChange={(event) => {
          const input = event.target
          const next = input.value === '' ? 0 : Number(input.value)
          const valid = !input.validity.badInput && isValidDiscountPercent(next)
          setText(input.value)
          setInvalid(!valid)
          onValidityChange(valid)
          if (valid) onChange({ percent: next, note: value?.note ?? '' })
        }} />
    </label>
    <label className="quote-editor__wide">
      Discount note (shown on customer quote)
      <textarea aria-label="Discount note" value={value?.note ?? ''} maxLength={1000} disabled={disabled}
        placeholder="e.g. Pensioner discount" rows={2}
        onChange={(event) => onChange({ percent, note: event.target.value })} />
    </label>
    <p className="muted small quote-editor__wide">Applied to the whole quote before GST, including add-ons and colour charges. Use 0 for no discount.</p>
    {invalid && <p className="price-result--error quote-editor__wide" role="alert">
      Enter a discount percentage from 0 to 100. Totals still show the last valid discount.
    </p>}
  </>
}
