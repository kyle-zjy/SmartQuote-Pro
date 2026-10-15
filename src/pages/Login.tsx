import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../lib/authContext'
import { DEFAULT_STAFF, type StaffRole } from '../lib/staffStore'

const PORTALS: Record<StaffRole, { title: string; blurb: string; hint: string; home: string }> = {
  staff: {
    title: 'Staff sign-in',
    blurb: 'Create quotes, measure openings and submit them for office review.',
    hint: 'Demo account: staff@goldco.com.au / staff',
    home: '/',
  },
  admin: {
    title: 'Admin sign-in',
    blurb: 'Review submitted quotes, manage staff, company details and pricing.',
    hint: 'Demo account: admin@goldco.com.au / admin',
    home: '/admin/reviews',
  },
}

export function LoginChooser() {
  const { session } = useAuth()
  if (session) return <Navigate to={PORTALS[session.role].home} replace />

  return (
    <div className="login-page">
      <div className="login-card login-card--chooser">
        <span className="brand-mark login-card__mark" aria-hidden="true">SQ</span>
        <h1>Sign in to SmartQuote Pro</h1>
        <p className="muted">Choose how you want to sign in.</p>
        <div className="login-portals">
          <Link to="/login/staff" className="login-portal">
            <UserOutlined className="login-portal__icon" aria-hidden="true" />
            <span className="login-portal__title">Staff login</span>
            <span className="muted small">{PORTALS.staff.blurb}</span>
          </Link>
          <Link to="/login/admin" className="login-portal login-portal--admin">
            <SafetyCertificateOutlined className="login-portal__icon" aria-hidden="true" />
            <span className="login-portal__title">Admin login</span>
            <span className="muted small">{PORTALS.admin.blurb}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function LoginForm() {
  const { portal: rawPortal } = useParams()
  const portal: StaffRole | null = rawPortal === 'admin' || rawPortal === 'staff' ? rawPortal : null
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const demoAccount = DEFAULT_STAFF.find((member) => member.role === portal)
  const [email, setEmail] = useState(demoAccount?.email ?? '')
  const [password, setPassword] = useState(demoAccount?.password ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    setEmail(demoAccount?.email ?? '')
    setPassword(demoAccount?.password ?? '')
    setError('')
  }, [demoAccount])

  if (!portal) return <Navigate to="/login" replace />
  if (session?.role === portal) return <Navigate to={PORTALS[portal].home} replace />

  const config = PORTALS[portal]
  const from = (location.state as { from?: string } | null)?.from

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!portal) return
    const result = signIn(email, password, portal)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const canReturn = from && (portal === 'admin' || !from.startsWith('/admin'))
    navigate(canReturn ? from : config.home, { replace: true })
  }

  const other: StaffRole = portal === 'admin' ? 'staff' : 'admin'

  return (
    <div className="login-page">
      <form className={`login-card login-card--${portal}`} onSubmit={handleSubmit} noValidate>
        <span className="brand-mark login-card__mark" aria-hidden="true">SQ</span>
        <h1>{config.title}</h1>
        <p className="muted">{config.blurb}</p>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <p className="login-card__error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="primary-button login-card__submit">
          Sign in
        </button>
        <p className="muted small">{config.hint}</p>
        <div className="login-card__switch">
          <Link to="/login" className="link-button">
            &larr; Back
          </Link>
          <Link to={`/login/${other}`} state={location.state} className="link-button">
            {other === 'admin' ? 'Admin login' : 'Staff login'} &rarr;
          </Link>
        </div>
      </form>
    </div>
  )
}
