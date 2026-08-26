import type { PriceLookupResult } from '../lib/priceLookup'

const REASON_MESSAGES: Record<string, string> = {
  // TOO_Large error unnecessary as all quotes will be taken in person at the location.
  TOO_LARGE: 'This size is larger than the maximum we can auto-quote. Please contact us for a custom quote.',
  UNAVAILABLE: 'This exact width/height combination is not available for this product.',
}

export default function PriceResultCard({
  result,
  extraSurcharge,
  formatCurrency,
}: {
  result: PriceLookupResult
  extraSurcharge: number
  formatCurrency: (n: number) => string
}) {
  if (!result.ok) {
    return <div className="price-result price-result--error">{REASON_MESSAGES[result.reason]}</div>
  }

  const total = result.price + extraSurcharge

  return (
    <div className="price-result">
      <div className="price-result__amount">{formatCurrency(total)}</div>
      <div className="muted small">
        Priced at {result.matchedWidth} x {result.matchedHeight} mm bracket
        {extraSurcharge > 0 && ` · includes ${formatCurrency(extraSurcharge)} extras`}
      </div>
    </div>
  )
}
