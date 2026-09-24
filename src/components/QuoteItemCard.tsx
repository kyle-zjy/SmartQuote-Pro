import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/formatCurrency'
import { effectiveFrameColour } from '../lib/frameColour'
import { usePricing } from '../lib/pricingContext'
import type { QuoteLineItem } from '../lib/quoteContext'
import { configLabel } from '../lib/quoteSheet'
import { itemPrice } from '../lib/quoteTotals'
import { sheetCodeImage } from '../lib/sheetCodeImages'

export default function QuoteItemCard({
  item,
  quoteId,
  quoteFrameColour,
  quoteCustomFrameColour,
  locked,
  onRemove,
  onSetQuantity,
  onOverridePrice,
}: {
  item: QuoteLineItem
  quoteId: string
  quoteFrameColour: string
  quoteCustomFrameColour: string
  locked: boolean
  onRemove: (id: string) => void
  onSetQuantity: (id: string, quantity: number) => void
  onOverridePrice: (id: string, finalPrice: number) => void
}) {
  const { data } = usePricing()
  const product = item.productKey ? data.products.find((p) => p.key === item.productKey) : undefined
  const isStructured = Boolean(item.location && item.configurationCode)

  function handleDelete() {
    if (window.confirm(`Remove "${item.description}" from this quote?`)) onRemove(item.id)
  }

  const toneClass = item.productKey ? ` product-tone product-tone--${item.productKey}` : ''

  return (
    <div className={`quote-item-card${toneClass}`}>
      {isStructured && item.configurationCode && (
        <img
          className="quote-item-card__thumb"
          src={sheetCodeImage(item.configurationCode)}
          alt={item.configurationCode}
        />
      )}
      <div className="quote-item-card__body">
        {isStructured ? (
          <>
            <p className="quote-item-card__title">
              {item.location} — {product?.name ?? item.productKey}
            </p>
            <p className="muted small">
              {item.configurationCode} · {configLabel(item.configurationCode ?? '')}
              {item.openingWidthMm && item.openingHeightMm
                ? ` · ${item.openingWidthMm} × ${item.openingHeightMm} mm`
                : ''}
              {' · '}
              {effectiveFrameColour(item, quoteFrameColour, quoteCustomFrameColour)}
            </p>
            {item.addons && item.addons.length > 0 && (
              <p className="muted small">Add-ons: {item.addons.map((a) => a.name).join(', ')}</p>
            )}
            {(item.lockHeightMm || item.lockSide || item.centreTongue || item.bowed) && (
              <p className="muted small">
                {[
                  item.lockHeightMm ? `Lock height: ${item.lockHeightMm} mm` : '',
                  item.lockSide ? `Lock side: ${item.lockSide}` : '',
                  item.centreTongue ? 'Centre tongue' : '',
                  item.bowed ? 'Door bowed' : '',
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            {item.note && <p className="muted small">Note: {item.note}</p>}
          </>
        ) : (
          <>
            <p className="quote-item-card__title">{item.description}</p>
            <p className="muted small">
              {item.detail}
              {item.room ? ` · ${item.room}` : ''}
            </p>
          </>
        )}

        <div className="quote-item-card__row">
          <label className="quote-item-card__qty">
            Qty
            <input
              type="number"
              min={1}
              value={item.quantity}
              disabled={locked}
              onChange={(e) => onSetQuantity(item.id, Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label className="quote-item-card__qty">
            Unit price
            <input
              type="number"
              min={0}
              step={1}
              value={itemPrice(item)}
              disabled={locked}
              onChange={(e) => onOverridePrice(item.id, Number(e.target.value))}
            />
          </label>
          <span className="quote-item-card__price">
            × {item.quantity} = {formatCurrency(itemPrice(item) * item.quantity)}
            {item.priceOverridden && <span className="muted small"> · manually overridden</span>}
          </span>
        </div>

        <div className="quote-item-card__actions">
          {locked ? (
            <>
              <button type="button" className="link-button" disabled>
                Edit
              </button>
              <button type="button" className="link-button" disabled>
                Duplicate
              </button>
              <button type="button" className="link-button" disabled>
                Reuse
              </button>
            </>
          ) : (
            <>
              <Link className="link-button" to={`/quotes/${quoteId}/items/${item.id}/edit`}>
                Edit
              </Link>
              <Link className="link-button" to={`/quotes/${quoteId}/items/new?basedOn=${item.id}&mode=duplicate`}>
                Duplicate
              </Link>
              <Link className="link-button" to={`/quotes/${quoteId}/items/new?basedOn=${item.id}&mode=reuse`}>
                Reuse
              </Link>
            </>
          )}
          <button type="button" className="link-button" onClick={handleDelete} disabled={locked}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
