import { lazy, Suspense } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuote } from './lib/quoteContext'

const Quotes = lazy(() => import('./pages/Quotes'))
const QuoteIntake = lazy(() => import('./pages/QuoteIntake'))
const QuoteWorkspace = lazy(() => import('./pages/QuoteWorkspace'))
const ItemWizard = lazy(() => import('./pages/quote-item/ItemWizard'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminCompany = lazy(() => import('./pages/AdminCompany'))
const AdminPricing = lazy(() => import('./pages/AdminPricing'))

function PageFallback() {
  return (
    <div className="page-fallback" role="status">
      <span className="page-fallback__dot" aria-hidden="true" />
      <p className="muted">Loading…</p>
    </div>
  )
}

export default function App() {
  const { items, quoteNo, savedQuotes } = useQuote()
  const { pathname } = useLocation()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const savedQuoteCount = new Set(savedQuotes.map((record) => record.quoteNo)).size

  const segments = pathname.split('/').filter(Boolean)
  const onWorkspacePage = segments[0] === 'quotes' && segments.length === 2 && segments[1] !== 'new'
  const onItemWizardPage = segments[0] === 'quotes' && segments[2] === 'items'
  const contentClass = onWorkspacePage
    ? 'content content--quote'
    : onItemWizardPage
      ? 'content content--sheet'
      : 'content'

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/quotes" className="brand" aria-label="SmartQuote Pro">
          <span className="brand-mark" aria-hidden="true">
            SQ
          </span>
          <span>SmartQuote Pro</span>
        </NavLink>
        <nav className="topnav">
          <NavLink to="/quotes" end>
            Quotes
            {savedQuoteCount > 0 ? <span className="nav-count">{savedQuoteCount}</span> : null}
          </NavLink>
          <NavLink to={`/quotes/${quoteNo}`}>
            Current Quote
            {itemCount > 0 ? <span className="nav-count">{itemCount}</span> : null}
          </NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>

      <main className={contentClass}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/new" element={<QuoteIntake />} />
            <Route path="/quotes/:id" element={<QuoteWorkspace />} />
            <Route path="/quotes/:id/items/new" element={<ItemWizard />} />
            <Route path="/quotes/:id/items/:itemId/edit" element={<ItemWizard />} />
            <Route path="/admin" element={<Admin />}>
              <Route index element={<AdminCompany />} />
              <Route path="pricing" element={<AdminPricing />} />
            </Route>

            {/* Legacy routes from the old five-page layout redirect instead of 404ing. */}
            <Route path="/" element={<Navigate to="/quotes" replace />} />
            <Route path="/product/:productKey" element={<Navigate to="/quotes" replace />} />
            <Route path="/addons" element={<Navigate to="/quotes" replace />} />
            <Route path="/sheet" element={<Navigate to="/quotes" replace />} />
            <Route path="/sheet/:code" element={<Navigate to="/quotes" replace />} />
            <Route path="/quote" element={<Navigate to={`/quotes/${quoteNo}`} replace />} />
            <Route path="/saved/:status?" element={<Navigate to="/quotes" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
