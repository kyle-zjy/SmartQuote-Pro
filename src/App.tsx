import { lazy, Suspense } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuote } from './lib/quoteContext'
import { ConfigProvider } from 'antd'
import { AppstoreOutlined, FileTextOutlined, FormOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import { useAuth } from './lib/authContext'

const Quotes = lazy(() => import('./pages/Quotes'))
const Home = lazy(() => import('./pages/Home'))
const QuoteIntake = lazy(() => import('./pages/QuoteIntake'))
const QuoteWorkspace = lazy(() => import('./pages/QuoteWorkspace'))
const ItemWizard = lazy(() => import('./pages/quote-item/ItemWizard'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminCompany = lazy(() => import('./pages/AdminCompany'))
const AdminPricing = lazy(() => import('./pages/AdminPricing'))
const AdminReviews = lazy(() => import('./pages/AdminReviews'))
const AdminStaff = lazy(() => import('./pages/AdminStaff'))
const LoginChooser = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginChooser })))
const LoginForm = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginForm })))

function PageFallback() {
  return (
    <div className="page-fallback" role="status">
      <span className="page-fallback__dot" aria-hidden="true" />
      <p className="muted">Loading…</p>
    </div>
  )
}

export default function App() {
  const { session } = useAuth()
  const { pathname } = useLocation()

  if (pathname === '/login' || pathname.startsWith('/login/')) {
    return (
      <ConfigProvider theme={THEME}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginChooser />} />
            <Route path="/login/:portal" element={<LoginForm />} />
          </Routes>
        </Suspense>
      </ConfigProvider>
    )
  }

  if (!session) return <Navigate to="/login" replace state={{ from: pathname }} />
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return <Navigate to="/login/admin" replace state={{ from: pathname }} />
  }

  return <AppShell />
}

const THEME = { token: { colorPrimary: '#1d4ed8', borderRadius: 8, fontFamily: "'DM Sans', system-ui, sans-serif" } }

function AppShell() {
  const { items, quoteNo, savedQuotes } = useQuote()
  const { user, isAdmin, signOut } = useAuth()
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
    <ConfigProvider theme={THEME}>
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="SmartQuote Pro home">
          <span className="brand-mark" aria-hidden="true">SQ</span>
          <span>SmartQuote <span className="brand-pro">PRO</span></span>
        </NavLink>
        <nav className="topnav" aria-label="Main navigation">
          <NavLink to="/" end><AppstoreOutlined aria-hidden="true" />Home</NavLink>
          <NavLink to="/quotes" end>
            <FileTextOutlined aria-hidden="true" />Quotes
            {savedQuoteCount > 0 ? <span className="nav-count">{savedQuoteCount}</span> : null}
          </NavLink>
          <NavLink to={`/quotes/${encodeURIComponent(quoteNo ?? "")}`}>
            <FormOutlined aria-hidden="true" />Current Quote
            {itemCount > 0 ? <span className="nav-count">{itemCount}</span> : null}
          </NavLink>
          {isAdmin ? <NavLink to="/admin"><SettingOutlined aria-hidden="true" />Admin</NavLink> : null}
          <span className="topnav__user" title={user?.email}>
            {user?.name}
            <span className={`topnav__role topnav__role--${isAdmin ? 'admin' : 'staff'}`}>{isAdmin ? 'Admin' : 'Staff'}</span>
          </span>
          <button type="button" className="topnav__signout" onClick={signOut}>
            <LogoutOutlined aria-hidden="true" />Sign out
          </button>
        </nav>
      </header>

      <main className={contentClass}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/new" element={<QuoteIntake />} />
            <Route path="/quotes/:id" element={<QuoteWorkspace />} />
            <Route path="/quotes/:id/items/new" element={<ItemWizard />} />
            <Route path="/quotes/:id/items/:itemId/edit" element={<ItemWizard />} />
            <Route path="/admin" element={<Admin />}>
              <Route index element={<AdminCompany />} />
              <Route path="pricing" element={<AdminPricing />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="staff" element={<AdminStaff />} />
            </Route>

            {/* Legacy routes from the old five-page layout redirect instead of 404ing. */}
            <Route path="/product/:productKey" element={<Navigate to="/quotes" replace />} />
            <Route path="/addons" element={<Navigate to="/quotes" replace />} />
            <Route path="/sheet" element={<Navigate to="/quotes" replace />} />
            <Route path="/sheet/:code" element={<Navigate to="/quotes" replace />} />
            <Route path="/quote" element={<Navigate to={`/quotes/${encodeURIComponent(quoteNo ?? "")}`} replace />} />
            <Route path="/saved/:status?" element={<Navigate to="/quotes" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
    </ConfigProvider>
  )
}
