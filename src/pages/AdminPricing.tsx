import ExcelDropZone from '../components/ExcelDropZone'
import { usePricing } from '../lib/pricingContext'

export default function AdminPricing() {
  const { data } = usePricing()

  return (
    <div className="admin-form">
      <h2>Price list</h2>
      <p className="muted small">
        Upload an updated price list to save shared pricing for all staff. Existing quote prices and issued
        documents keep their saved values. Restore the built-in prices with “Restore default price list”.
      </p>
      <ExcelDropZone />

      <h2>Current products ({data.products.length})</h2>
      <table className="quote-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Key</th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((product) => (
            <tr key={product.key}>
              <td>{product.name}</td>
              <td className="muted small">{product.key}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
