import { NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import ProductCalculator from './pages/ProductCalculator'
import QuoteSummary from './pages/QuoteSummary'
import AddOns from './pages/AddOns'
import { useQuote } from './lib/quoteContext'

export default function App() {
  const { items } = useQuote()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          SmartQuote Pro
        </NavLink>
        <nav className="topnav">
          <NavLink to="/" end>
            Products
          </NavLink>
          <NavLink to="/addons">Add-ons</NavLink>
          <NavLink to="/quote">Quote{itemCount > 0 ? ` (${itemCount})` : ''}</NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:productKey" element={<ProductCalculator />} />
          <Route path="/addons" element={<AddOns />} />
          <Route path="/quote" element={<QuoteSummary />} />
        </Routes>
      </main>
    </div>
  )
}
