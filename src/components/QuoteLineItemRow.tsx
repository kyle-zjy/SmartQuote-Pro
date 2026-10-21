import { customerQuoteNote, displayDescription, productPrice, quoteExtras, extraLabel, petDoorCustomerQuoteNote, type QuoteAudience } from '../lib/quotePrint'
import type { QuoteLineItem } from '../lib/quoteContext'
import { itemPrice, lineAmount } from '../lib/quoteTotals'
import { usePricing } from '../lib/pricingContext'
import { sheetCodeImage } from '../lib/sheetCodeImages'
import { configLabel } from '../lib/quoteSheet'
import MeasurementDrawingPreview from './MeasurementDrawingPreview'

function siteDetails(item: QuoteLineItem): string {
  return [
    item.centreTongue ? 'Lock height: N/A' : item.lockHeightMm ? `Lock height: ${item.lockHeightMm} mm` : '',
    item.centreTongue && item.lockTopMm && item.lockCentreMm && item.lockBottomMm
      ? `Locks: top ${item.lockTopMm}, centre ${item.lockCentreMm}, bottom ${item.lockBottomMm} mm` : '',
    item.lockSide ? `Lock side: ${item.lockSide}` : '',
    item.centreTongue ? 'Centre tongue' : '',
    item.midRailRequired && item.midRailHeightMm ? `Mid-rail: ${item.midRailHeightMm} mm` : '',
    item.interlockAdjustment ? `Interlock: ${item.interlockAdjustment === 'remove-zero' ? '0' : '5'} mm ${item.interlockAdjustment === 'add' ? 'added' : 'removed'}` : '',
    item.bowed ? 'Door bowed' : '',
  ].filter(Boolean).join(' · ')
}

export default function QuoteLineItemRow({
  item,
  onQuantityChange,
  onDescriptionChange,
  onUnitPriceChange,
  onRemove,
  formatCurrency,
  readOnly = false,
  audience = 'customer',
}: {
  item: QuoteLineItem
  onQuantityChange?: (quantity: number) => void
  onDescriptionChange?: (description: string) => void
  onUnitPriceChange?: (unitPrice: number) => void
  onRemove?: () => void
  formatCurrency: (n: number) => string
  readOnly?: boolean
  audience?: QuoteAudience
}) {
  const { data: pricingData } = usePricing()
  const customerNote = customerQuoteNote(item)
  const petDoorNote = petDoorCustomerQuoteNote(item)
  const extras = quoteExtras(item)
  const basePrice = productPrice(item)
  const fullPrice = itemPrice(item)
  const description = displayDescription(item, audience, pricingData)
  const addonsLine = extras
    .map((extra) => (audience === 'customer' ? `${extraLabel(extra.name)} (${formatCurrency(extra.price)})` : extraLabel(extra.name)))
    .join(' · ')
  const details = (
    <>
      {audience === 'customer' && (
        <>
          {customerNote && !petDoorNote && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>Customer notes: {customerNote}</div>}
          {addonsLine && <div className="small">Addons: {addonsLine}</div>}
          {petDoorNote && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>Customer notes: {petDoorNote}</div>}
        </>
      )}
      {audience === 'factory' && (
        <>
          {item.configurationCode && <div className="small">Configuration: {item.configurationCode}</div>}
          {item.measurements && Object.keys(item.measurements).length > 0 && (
            <div className="small">Measurements: {Object.entries(item.measurements).map(([key, value]) => `${key}: ${value}`).join(' · ')}</div>
          )}
          {addonsLine && <div className="small">Addons: {addonsLine}</div>}
          {siteDetails(item) && <div className="muted small">{siteDetails(item)}</div>}
          {item.note && <div className="muted small">Production notes: {item.note}</div>}
          {item.measurementDrawing && item.measurementDrawing.length > 0 && item.configurationCode && sheetCodeImage(item.configurationCode) && (
            <div className="quote-line-drawing">
              <MeasurementDrawingPreview
                src={sheetCodeImage(item.configurationCode) ?? ''}
                alt={configLabel(item.configurationCode)}
                strokes={item.measurementDrawing}
              />
            </div>
          )}
        </>
      )}
    </>
  )
  return (
    <tr>
      <td className="quote-sheet__qty">
        {readOnly ? (
          item.quantity
        ) : (
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onQuantityChange?.(Number(e.target.value))}
            className="qty-input"
          />
        )}
      </td>
      <td>
        {readOnly ? (
          <>
            <div>{description}</div>
            {details}
          </>
        ) : (
          <>
            <textarea
              className="desc-input"
              rows={2}
              value={item.description}
              onChange={(e) => onDescriptionChange?.(e.target.value)}
            />
            {details}
          </>
        )}
      </td>
      {audience === 'customer' && (
        <>
          <td className="quote-sheet__price">
            {readOnly ? (
              formatCurrency(fullPrice)
            ) : (
              <input
                type="number"
                min={0}
                step={1}
                value={basePrice}
                onChange={(e) => onUnitPriceChange?.(Number(e.target.value) + extras.reduce((sum, extra) => sum + extra.price, 0))}
                className="price-input"
              />
            )}
          </td>
          <td className="quote-sheet__price">{formatCurrency(lineAmount(fullPrice, item.quantity))}</td>
        </>
      )}
      {!readOnly && (
        <td className="no-print">
          <button type="button" className="link-button" onClick={onRemove}>
            Remove
          </button>
        </td>
      )}
    </tr>
  )
}
