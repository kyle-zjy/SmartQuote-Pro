import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { calcConfiguredPrice, DOUBLE_HUNG_SURCHARGE, STANDARD_MESH } from '../lib/configuredPrice'
import { formatQuoteDescription } from '../lib/lineDescription'
import { formatCurrency } from '../lib/formatCurrency'
import { LINE_FIT_EXTRAS, fitExtraPhrase } from '../lib/lineExtras'
import { useQuote } from '../lib/quoteContext'
import { usePricing } from '../lib/pricingContext'
import PriceResultCard from '../components/PriceResultCard'
import { ROOM_TYPES } from '../lib/roomTypes'

const OTHER_ROOM = 'Other'

export default function ProductCalculator() {
  const { productKey } = useParams()
  const { data, addons } = usePricing()
  const product = data.products.find((p) => p.key === productKey)
  const { addItem, status } = useQuote()
  const issued = status === 'issued'

  const [categoryKey, setCategoryKey] = useState(product?.categories[0]?.key)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [meshOption, setMeshOption] = useState(STANDARD_MESH)
  const [doubleHung, setDoubleHung] = useState(false)
  const [room, setRoom] = useState(ROOM_TYPES[0])
  const [customRoom, setCustomRoom] = useState('')
  const [note, setNote] = useState('')
  const [added, setAdded] = useState(false)
  const [fitExtras, setFitExtras] = useState<string[]>([])

  const category = product?.categories.find((c) => c.key === categoryKey) ?? product?.categories[0]

  const widthMm = Number(width)
  const heightMm = Number(height)
  const hasValidInput = widthMm > 0 && heightMm > 0

  const configured = useMemo(() => {
    if (!category || !hasValidInput) return null
    return calcConfiguredPrice(category, widthMm, heightMm, {
      meshOption,
      doubleHung: product?.key === 'flyscreens' && category.key === 'windows' && doubleHung,
    })
  }, [category, doubleHung, hasValidInput, heightMm, meshOption, product?.key, widthMm])

  const result = configured?.lookup ?? null
  const meshExtras = configured?.extras ?? 0
  const fitExtraItems = LINE_FIT_EXTRAS.map((extra) => ({
    ...extra,
    price: addons.find((item) => item.name === extra.addonName)?.price ?? 0,
  })).filter((extra) => extra.price > 0)
  const fitExtraTotal = fitExtraItems
    .filter((extra) => fitExtras.includes(extra.addonName))
    .reduce((sum, extra) => sum + extra.price, 0)
  const totalExtras = meshExtras + fitExtraTotal

  if (!product) {
    return <Navigate to="/" replace />
  }

  const isFlyscreenWindows = product.key === 'flyscreens' && category?.key === 'windows'
  const doubleHungSurcharge = isFlyscreenWindows && doubleHung ? DOUBLE_HUNG_SURCHARGE : 0

  function handleCategoryChange(key: string) {
    setCategoryKey(key)
    setMeshOption(STANDARD_MESH)
    setDoubleHung(false)
    setFitExtras([])
    setAdded(false)
  }

  function handleAddToQuote() {
    if (issued || !category || !result?.ok) return
    const extras = [
      ...(doubleHungSurcharge > 0 ? ['double hung'] : []),
      ...fitExtras.map((name) => fitExtraPhrase(name)),
    ]
    const resolvedRoom = room === OTHER_ROOM && customRoom.trim() ? customRoom.trim() : room
    addItem({
      description: formatQuoteDescription({
        widthMm,
        heightMm,
        productName: product!.name,
        categoryKey: category.key,
        categoryLabel: category.label,
        meshOption: meshOption !== STANDARD_MESH ? meshOption : undefined,
        extras,
        room: resolvedRoom,
      }),
      detail: `${widthMm} x ${heightMm} mm`,
      quantity: 1,
      unitPrice: (configured?.unitPrice ?? result.price + meshExtras) + fitExtraTotal,
      room: resolvedRoom,
      note: note.trim(),
      productKey: product!.key,
    })
    setAdded(true)
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to products</Link>
      </p>
      <h1>{product.name}</h1>
      {issued && (
        <p className="price-result--error">
          The open quote is issued and locked. Start a new quote before adding items.
        </p>
      )}
      {product.note && <p className="muted">{product.note}</p>}

      <div className="tabs">
        {product.categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className={c.key === category?.key ? 'tab tab--active' : 'tab'}
            onClick={() => handleCategoryChange(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category && (
        <div className="calculator">
          <div className="field-row">
            <label>
              Height (mm)
              <input
                type="number"
                min={0}
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value)
                  setAdded(false)
                }}
                placeholder={`e.g. ${category.heights[Math.floor(category.heights.length / 2)]}`}
              />
            </label>
            <label>
              Width (mm)
              <input
                type="number"
                min={0}
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value)
                  setAdded(false)
                }}
                placeholder={`e.g. ${category.widths[Math.floor(category.widths.length / 2)]}`}
              />
            </label>
          </div>

          {category.extras && category.extras.options.length > 0 && (
            <label className="field-row__single">
              Mesh type
              <select
                value={meshOption}
                onChange={(e) => {
                  setMeshOption(e.target.value)
                  setAdded(false)
                }}
              >
                <option value={STANDARD_MESH}>Standard (included)</option>
                {category.extras.options.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {fitExtraItems.length > 0 && (
            <div className="fit-extras">
              <p className="small">Add to this line</p>
              {fitExtraItems.map((extra) => (
                <label key={extra.addonName} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={fitExtras.includes(extra.addonName)}
                    onChange={(e) => {
                      setFitExtras((current) =>
                        e.target.checked
                          ? [...current, extra.addonName]
                          : current.filter((name) => name !== extra.addonName),
                      )
                      setAdded(false)
                    }}
                  />
                  {extra.phrase} (+{formatCurrency(extra.price)})
                </label>
              ))}
            </div>
          )}

          {isFlyscreenWindows && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={doubleHung}
                onChange={(e) => {
                  setDoubleHung(e.target.checked)
                  setAdded(false)
                }}
              />
              Double hung window (+{formatCurrency(DOUBLE_HUNG_SURCHARGE)})
            </label>
          )}

          <label className="field-row__single">
            Room
            <select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value)
                if (e.target.value !== OTHER_ROOM) setCustomRoom('')
              }}
            >
              {ROOM_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {room === OTHER_ROOM && (
            <label className="field-row__single">
              Room name
              <input
                type="text"
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                placeholder="e.g. Sunroom"
              />
            </label>
          )}

          <label className="field-row__single">
            Notes (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any remarks for this item"
              rows={2}
            />
          </label>

          {hasValidInput && result && (
            <>
              <PriceResultCard result={result} extraSurcharge={totalExtras} formatCurrency={formatCurrency} />
              {result.ok && (
                <button type="button" className="primary-button" onClick={handleAddToQuote} disabled={issued}>
                  Add to quote
                </button>
              )}
              {added && <p className="muted small">Added to your quote.</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
