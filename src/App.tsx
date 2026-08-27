import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuote } from './lib/quoteContext'

const Home = lazy(() => import('./pages/Home'))
const ProductCalculator = lazy(() => import('./pages/ProductCalculator'))
const QuoteSummary = lazy(() => import('./pages/QuoteSummary'))
const SavedQuotes = lazy(() => import('./pages/SavedQuotes'))
const AddOns = lazy(() => import('./pages/AddOns'))
const Admin = lazy(() => import('./pages/Admin'))
const QuoteSheet = lazy(() => import('./pages/QuoteSheet'))
const SheetMeasure = lazy(() => import('./pages/SheetMeasure'))

function PageFallback() {
  return <p className="muted">Loading…</p>
}

export default function App() {
  const { items, savedQuotes } = useQuote()
  const { pathname } = useLocation()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const savedQuoteCount = new Set(savedQuotes.map((record) => record.quoteNo)).size
  const onQuotePage = pathname === '/quote'
  const onSheetPage = pathname.startsWith('/sheet')

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
          <NavLink to="/sheet">Sheet</NavLink>
          <NavLink to="/saved">Saved{savedQuoteCount > 0 ? ` (${savedQuoteCount})` : ''}</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>

      <main className={onQuotePage ? 'content content--quote' : onSheetPage ? 'content content--sheet' : 'content'}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:productKey" element={<ProductCalculator />} />
            <Route path="/addons" element={<AddOns />} />
            <Route path="/quote" element={<QuoteSummary />} />
            <Route path="/sheet" element={<QuoteSheet />} />
            <Route path="/sheet/:code" element={<SheetMeasure />} />
            <Route path="/saved/:status?" element={<SavedQuotes />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
