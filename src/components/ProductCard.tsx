import { Link } from 'react-router-dom'
import type { Product } from '../types/pricing'

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.key}`} className="card product-card">
      <h3>{product.name}</h3>
      <p className="muted">
        {product.categories.map((c) => c.label).join(' · ')}
      </p>
      {product.pricingAsAt && <p className="muted small">Pricing as at {product.pricingAsAt}</p>}
    </Link>
  )
}
