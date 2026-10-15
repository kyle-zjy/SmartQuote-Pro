import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { listReviews } from '../lib/reviewStore'

export default function Admin() {
  const { user } = useAuth()
  const pending = listReviews().filter((r) => r.status === 'pending').length

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>Admin settings</h1>
          <p className="muted">
            Signed in as {user?.name ?? 'admin'}. Review submitted quotes, manage staff, and edit the company details
            and pricing that appear on every quote.
          </p>
        </div>
      </header>

      <nav className="saved-subnav" aria-label="Admin sections">
        <NavLink to="/admin" end className="saved-subnav__item">
          Company
        </NavLink>
        <NavLink to="/admin/pricing" className="saved-subnav__item">
          Pricing
        </NavLink>
        <NavLink to="/admin/reviews" className="saved-subnav__item">
          Office review
          {pending > 0 ? <span className="saved-subnav__count">{pending}</span> : null}
        </NavLink>
        <NavLink to="/admin/staff" className="saved-subnav__item">
          Staff
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
