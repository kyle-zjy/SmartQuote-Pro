import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useQuote } from './lib/quoteContext'

const Home = lazy(() => import('./pages/Home'))
const ProductCalculator = lazy(() => import('./pages/ProductCalculator'))
const QuoteSummary = lazy(() => import('./pages/QuoteSummary'))
const AddOns = lazy(() => import('./pages/AddOns'))

function PageFallback() {
  return <p className="muted">Loading…</p>
}

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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:productKey" element={<ProductCalculator />} />
            <Route path="/addons" element={<AddOns />} />
            <Route path="/quote" element={<QuoteSummary />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
