import { Link } from 'react-router-dom'
import { productTone, productWarrantyLabel, productWarrantyNote } from '../data/company'
import type { Product } from '../types/pricing'

export default function ProductCard({ product }: { product: Product }) {
  const tone = productTone(product.key)
  const warrantyLabel = productWarrantyLabel(product.key)
  const warranty = productWarrantyNote(product.key)

  return (
    <Link to={`/product/${product.key}`} className={`card product-card product-tone product-tone--${tone}`}>
      <div className="product-card__head">
        <h3>{product.name}</h3>
        {warrantyLabel ? <span className="product-tone-badge">{warrantyLabel}</span> : null}
      </div>
      <p className="muted">
        {product.categories.map((c) => c.label).join(' · ')}
      </p>
      {warranty ? <p className="product-tone-note">{warranty}</p> : null}
      {product.pricingAsAt && <p className="muted small">Pricing as at {product.pricingAsAt}</p>}
    </Link>
  )
}
