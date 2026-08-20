import { usePricing } from '../lib/pricingContext'
import ProductCard from '../components/ProductCard'
import ExcelDropZone from '../components/ExcelDropZone'

export default function Home() {
  const { data } = usePricing()

  return (
    <div>
      <h1>Get a quote</h1>
      <p className="muted">Pick a product line to calculate a supply &amp; install price. {data.note}.</p>
      <ExcelDropZone />
      <div className="card-grid">
        {data.products.map((product) => (
          <ProductCard key={product.key} product={product} />
        ))}
      </div>
    </div>
  )
}
