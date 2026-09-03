import { NavLink, Outlet } from 'react-router-dom'

export default function Admin() {
  return (
    <div className="admin-page">
      <h1>Admin settings</h1>
      <p className="muted">
        These details appear on every quote header and footer. Sign-in will be added later — anyone using this
        browser can edit them for now.
      </p>

      <nav className="saved-subnav" aria-label="Admin sections">
        <NavLink to="/admin" end className="saved-subnav__item">
          Company
        </NavLink>
        <NavLink to="/admin/pricing" className="saved-subnav__item">
          Pricing
        </NavLink>
      </nav>

      <Outlet />
    </div>
  )
}
