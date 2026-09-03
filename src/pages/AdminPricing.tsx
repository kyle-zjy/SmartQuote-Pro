import ExcelDropZone from '../components/ExcelDropZone'
import { usePricing } from '../lib/pricingContext'

export default function AdminPricing() {
  const { data } = usePricing()

  return (
    <div className="admin-form">
      <h2>Price list</h2>
      <p className="muted small">
        Upload an updated price list to replace the pricing used across the app for the rest of this browser
        session. This does not save to a server — closing the browser or clicking "Restore default price list"
        goes back to the built-in prices.
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
