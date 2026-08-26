import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuote } from './lib/quoteContext'

const Home = lazy(() => import('./pages/Home'))
const ProductCalculator = lazy(() => import('./pages/ProductCalculator'))
const QuoteSummary = lazy(() => import('./pages/QuoteSummary'))
const SavedQuotes = lazy(() => import('./pages/SavedQuotes'))
const AddOns = lazy(() => import('./pages/AddOns'))
const Admin = lazy(() => import('./pages/Admin'))

function PageFallback() {
  return <p className="muted">Loading…</p>
}

export default function App() {
  const { items, savedQuotes } = useQuote()
  const { pathname } = useLocation()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const onQuotePage = pathname === '/quote'

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
          <NavLink to="/saved">Saved{savedQuotes.length > 0 ? ` (${savedQuotes.length})` : ''}</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>

      <main className={onQuotePage ? 'content content--quote' : 'content'}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:productKey" element={<ProductCalculator />} />
            <Route path="/addons" element={<AddOns />} />
            <Route path="/quote" element={<QuoteSummary />} />
            <Route path="/saved" element={<SavedQuotes />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
