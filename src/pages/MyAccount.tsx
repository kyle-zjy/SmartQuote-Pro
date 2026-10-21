import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/authContext'
import { SERVER_MODE } from '../lib/apiClient'
import { PASSWORD_HINT, validNewPassword } from '../../server/src/passwordPolicy'

export default function MyAccount() {
  const { user, changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!validNewPassword(password)) {
      setError(PASSWORD_HINT)
      return
    }
    if (password !== confirm) {
      setError('The new passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await changePassword(current, password)
      setCurrent('')
      setPassword('')
      setConfirm('')
      setMessage(
        SERVER_MODE
          ? 'Password changed. Other signed-in sessions have been signed out.'
          : 'Password changed.',
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change your password.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="admin-panel">
      <h1>My account</h1>
      <p>
        {user?.name} · {user?.email}
      </p>
      {user?.mustChangePassword && (
        <p role="status">
          Change your temporary password before continuing to the shared workspace.
        </p>
      )}
      <form className="admin-form" onSubmit={submit}>
        <h2>Change password</h2>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-policy"
          />
        </label>
        <p id="password-policy" className="muted small">
          {PASSWORD_HINT}
        </p>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            required
            maxLength={256}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Changing password…' : 'Change password'}
        </button>
      </form>
    </section>
  )
}
