import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { extraSurcharge, findPrice } from '../lib/priceLookup'
import { formatCurrency } from '../lib/formatCurrency'
import { useQuote } from '../lib/quoteContext'
import { usePricing } from '../lib/pricingContext'
import PriceResultCard from '../components/PriceResultCard'

const STANDARD_MESH = 'Standard'
const DOUBLE_HUNG_SURCHARGE = 15

export default function ProductCalculator() {
  const { productKey } = useParams()
  const { data } = usePricing()
  const product = data.products.find((p) => p.key === productKey)
  const { addItem } = useQuote()

  const [categoryKey, setCategoryKey] = useState(product?.categories[0]?.key)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [meshOption, setMeshOption] = useState(STANDARD_MESH)
  const [doubleHung, setDoubleHung] = useState(false)
  const [added, setAdded] = useState(false)

  const category = product?.categories.find((c) => c.key === categoryKey) ?? product?.categories[0]

  const widthMm = Number(width)
  const heightMm = Number(height)
  const hasValidInput = widthMm > 0 && heightMm > 0

  const result = useMemo(() => {
    if (!category || !hasValidInput) return null
    return findPrice(category, widthMm, heightMm)
  }, [category, hasValidInput, widthMm, heightMm])

  if (!product) {
    return <Navigate to="/" replace />
  }

  const isFlyscreenWindows = product.key === 'flyscreens' && category?.key === 'windows'
  const meshSurcharge = category?.extras && hasValidInput ? extraSurcharge(category.extras, meshOption, heightMm) : 0
  const doubleHungSurcharge = isFlyscreenWindows && doubleHung ? DOUBLE_HUNG_SURCHARGE : 0
  const totalExtras = meshSurcharge + doubleHungSurcharge

  function handleCategoryChange(key: string) {
    setCategoryKey(key)
    setMeshOption(STANDARD_MESH)
    setDoubleHung(false)
    setAdded(false)
  }

  function handleAddToQuote() {
    if (!category || !result?.ok) return
    const meshNote = meshOption !== STANDARD_MESH ? `, ${meshOption} mesh` : ''
    const dhNote = doubleHungSurcharge > 0 ? ', double hung' : ''
    addItem({
      description: `${product!.name} - ${category.label}`,
      detail: `${widthMm} x ${heightMm} mm${meshNote}${dhNote}`,
      quantity: 1,
      unitPrice: result.price + totalExtras,
    })
    setAdded(true)
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to products</Link>
      </p>
      <h1>{product.name}</h1>
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

          {hasValidInput && result && (
            <>
              <PriceResultCard result={result} extraSurcharge={totalExtras} formatCurrency={formatCurrency} />
              {result.ok && (
                <button type="button" className="primary-button" onClick={handleAddToQuote}>
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
