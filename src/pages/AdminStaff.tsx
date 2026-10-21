import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuote } from '../lib/quoteContext'
import { useAuth } from '../lib/authContext'
import {
  AUTH_CHANGED_EVENT,
  STAFF_KEY,
  listStaff,
  type StaffMember,
  type StaffRole,
} from '../lib/staffStore'
import { createStaff, changeStaff, resetStaffPassword } from '../lib/serverStaff'
import { SERVER_DATA_EVENT, SERVER_MODE } from '../lib/apiClient'
import { PASSWORD_HINT, validNewPassword } from '../../server/src/passwordPolicy'
import { listReviews, readOwners, type ReviewStatus } from '../lib/reviewStore'
import { groupArchivedQuotes } from '../lib/quoteArchive'
import { displayQuoteNo, displayQuoteRevision } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'
import QuoteStatusBadge from '../components/QuoteStatusBadge'

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: 'Waiting for review',
  approved: 'Approved',
  returned: 'Returned',
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'staff' as StaffRole }

export default function AdminStaff() {
  const { user } = useAuth()
  const { savedQuotes, loadSavedQuote } = useQuote()
  const navigate = useNavigate()
  const [staff, setStaff] = useState<StaffMember[]>(() => listStaff())
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resetMember, setResetMember] = useState<StaffMember | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => setStaff(listStaff())
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STAFF_KEY) refresh()
    }
    window.addEventListener('storage', changed)
    window.addEventListener('focus', refresh)
    window.addEventListener(AUTH_CHANGED_EVENT, refresh)
    window.addEventListener(SERVER_DATA_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh)
      window.removeEventListener(SERVER_DATA_EVENT, refresh)
    }
  }, [])

  const activity = useMemo(() => {
    const owners = readOwners()
    const reviews = listReviews()
    const groups = groupArchivedQuotes(savedQuotes)
    const byStaff = new Map<
      string,
      Array<{
        quoteNo: string
        label: string
        status: ReviewStatus | null
        latest: (typeof groups)[number]['versions'][number]
      }>
    >()
    for (const group of groups) {
      const latest = group.versions[0]
      const review = reviews.find(
        (r) => r.quoteNo === group.quoteNo && r.version === latest.version,
      )
      const ownerId = owners[group.quoteNo] ?? review?.submittedBy ?? 'unassigned'
      const list = byStaff.get(ownerId) ?? []
      list.push({
        quoteNo: group.quoteNo,
        label: `${displayQuoteNo(latest.quote.quoteNo, latest.quote.quoteNumber)} · ${displayQuoteRevision(latest.version)}`,
        status: review?.status ?? null,
        latest,
      })
      byStaff.set(ownerId, list)
    }
    const submittedCount = new Map<string, number>()
    reviews.forEach((r) =>
      submittedCount.set(r.submittedBy, (submittedCount.get(r.submittedBy) ?? 0) + 1),
    )
    return { byStaff, submittedCount }
  }, [savedQuotes])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!validNewPassword(form.password)) {
      setError(PASSWORD_HINT)
      return
    }
    setBusy(true)
    const result = await createStaff(form).finally(() => setBusy(false))
    if (!result.ok) {
      setError(result.error)
      return
    }
    setStaff(listStaff())
    setForm(EMPTY_FORM)
    setError('')
    setMessage(`${result.member.name} added. They can sign in with ${result.member.email}.`)
  }

  async function handleUpdate(
    member: StaffMember,
    patch: Partial<Pick<StaffMember, 'role' | 'active'>>,
  ) {
    let next: StaffMember[]
    try {
      next = await changeStaff(member.id, patch)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update this account. Try again.')
      return
    }
    setError('')
    const changed = next.find((m) => m.id === member.id)
    if (
      !changed ||
      (patch.role && changed.role !== patch.role) ||
      (patch.active !== undefined && changed.active !== patch.active)
    ) {
      setMessage('At least one active admin is required.')
      return
    }
    setStaff(next)
    setMessage(`${member.name} updated.`)
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()
    if (!resetMember) return
    if (!validNewPassword(resetPassword)) {
      setResetError(PASSWORD_HINT)
      return
    }
    if (resetPassword !== resetConfirm) {
      setResetError('The temporary passwords do not match.')
      return
    }
    setBusy(true)
    setResetError('')
    try {
      await resetStaffPassword(resetMember.id, adminPassword, resetPassword)
      setMessage(
        `Password reset for ${resetMember.name}. Existing sessions ended. They must change the temporary password after signing in.`,
      )
      setResetMember(null)
      setResetPassword('')
      setResetConfirm('')
      setAdminPassword('')
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Could not reset this password.')
    } finally {
      setBusy(false)
    }
  }

  function openQuote(quoteNo: string) {
    if (!loadSavedQuote(quoteNo)) return
    navigate(`/quotes/${encodeURIComponent(quoteNo)}`)
  }

  const unassigned = activity.byStaff.get('unassigned') ?? []

  return (
    <section className="admin-panel">
      <h2>Staff</h2>
      <p className="muted small">
        See who created and submitted each quote, add new staff and control admin access.
      </p>

      {message ? (
        <p className="admin-panel__message" role="status">
          {message}
        </p>
      ) : null}

      <div className="saved-quotes-table-wrap">
        <table className="quote-table staff-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Quotes</th>
              <th>Submitted</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const quotes = activity.byStaff.get(member.id) ?? []
              const isOpen = expanded === member.id
              const isSelf = user?.id === member.id
              return [
                <tr key={member.id} className={member.active ? '' : 'staff-table__inactive'}>
                  <td>
                    {member.name}
                    {isSelf ? <span className="muted small"> (you)</span> : null}
                  </td>
                  <td>{member.email}</td>
                  <td>
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) => handleUpdate(member, { role: e.target.value as StaffRole })}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : member.id)}
                    >
                      {quotes.length} quote{quotes.length === 1 ? '' : 's'}
                    </button>
                  </td>
                  <td>{activity.submittedCount.get(member.id) ?? 0}</td>
                  <td>{member.active ? 'Active' : 'Deactivated'}</td>
                  <td>
                    {SERVER_MODE && !isSelf && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setResetMember(member)
                          setResetPassword('')
                          setResetConfirm('')
                          setAdminPassword('')
                          setResetError('')
                        }}
                      >
                        Reset password for {member.name}
                      </button>
                    )}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleUpdate(member, { active: !member.active })}
                      disabled={isSelf}
                    >
                      {member.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>,
                isOpen ? (
                  <tr key={`${member.id}:quotes`} className="staff-table__quotes">
                    <td colSpan={7}>
                      <QuoteList
                        quotes={quotes}
                        onOpen={openQuote}
                        empty={`${member.name} has no saved quotes yet.`}
                      />
                    </td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
        </table>
      </div>

      {resetMember && (
        <form className="admin-form" onSubmit={handleReset}>
          <h3>Reset password for {resetMember.name}</h3>
          <p className="muted small">
            Give this temporary password to the staff member privately. They must change it at their
            next sign-in. Existing sessions will end.
          </p>
          <label>
            Your administrator password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </label>
          <label>
            New temporary password
            <input
              type="password"
              autoComplete="new-password"
              required
              maxLength={256}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
          </label>
          <p className="muted small">{PASSWORD_HINT}</p>
          <label>
            Confirm temporary password
            <input
              type="password"
              autoComplete="new-password"
              required
              maxLength={256}
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
            />
          </label>
          {resetError && <p role="alert">{resetError}</p>}
          <div className="quote-actions">
            <button type="submit" className="primary-button" disabled={busy}>
              Reset password
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setResetMember(null)
                setAdminPassword('')
                setResetPassword('')
                setResetConfirm('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {unassigned.length > 0 ? (
        <details className="staff-unassigned">
          <summary>
            {unassigned.length} quote{unassigned.length === 1 ? '' : 's'} saved before sign-in was
            added (no owner)
          </summary>
          <QuoteList quotes={unassigned} onOpen={openQuote} empty="" />
        </details>
      ) : null}

      <form className="admin-form staff-form" onSubmit={handleAdd} noValidate>
        <h3>Add new staff</h3>
        <div className="field-row">
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            Temporary password
            <input
              type="password"
              autoComplete="new-password"
              maxLength={256}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            Access
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
            >
              <option value="staff">Staff — quotes only</option>
              <option value="admin">Admin — review, staff, settings</option>
            </select>
          </label>
        </div>
        <p className="muted small">
          {PASSWORD_HINT} New staff must change their temporary password after signing in.
        </p>
        {error ? (
          <p className="login-card__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="quote-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            Add staff member
          </button>
        </div>
      </form>
    </section>
  )
}

function QuoteList({
  quotes,
  onOpen,
  empty,
}: {
  quotes: Array<{
    quoteNo: string
    label: string
    status: ReviewStatus | null
    latest: {
      total: number
      quote: { customer: { name: string }; status: import('../lib/quoteLifecycle').QuoteStatus }
    }
  }>
  onOpen: (quoteNo: string) => void
  empty: string
}) {
  if (quotes.length === 0) return <p className="muted small">{empty}</p>
  return (
    <ul className="staff-quotes">
      {quotes.map((q) => (
        <li key={q.quoteNo}>
          <button type="button" className="link-button" onClick={() => onOpen(q.quoteNo)}>
            Quote {q.label}
          </button>
          <span>{q.latest.quote.customer.name || 'No customer'}</span>
          <QuoteStatusBadge status={q.latest.quote.status} />
          <span className="muted small">{q.status ? REVIEW_LABEL[q.status] : 'Not submitted'}</span>
          <span>{formatCurrency(q.latest.total)}</span>
        </li>
      ))}
    </ul>
  )
}
