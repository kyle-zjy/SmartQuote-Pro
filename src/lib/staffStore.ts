import { workspaceStorage } from './workspaceStorage'
export type StaffRole = 'staff' | 'admin'

export interface StaffMember {
  id: string
  name: string
  email: string
  /** Local prototype compatibility only; shared-mode public records contain ''. */
  password: string
  role: StaffRole
  active: boolean
  mustChangePassword?: boolean
  createdAt: string
}

export interface StaffSession {
  staffId: string
  role: StaffRole
  signedInAt: string
}

export const STAFF_KEY = 'smartquote-pro:staff'
export const SESSION_KEY = 'smartquote-pro:session'
export const AUTH_CHANGED_EVENT = 'smartquote-pro:auth-changed'

function notifyAuthChanged(storage: Storage) {
  if (typeof window !== 'undefined' && storage === workspaceStorage) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function isStaffMember(value: unknown): value is StaffMember {
  if (!value || typeof value !== 'object') return false
  const member = value as Partial<StaffMember>
  return typeof member.id === 'string' && Boolean(member.id) && typeof member.name === 'string' &&
    typeof member.email === 'string' && typeof member.password === 'string' &&
    (member.role === 'staff' || member.role === 'admin') && typeof member.active === 'boolean' &&
    typeof member.createdAt === 'string'
}

export const DEFAULT_STAFF: StaffMember[] = [
  {
    id: 'admin',
    name: 'Office Admin',
    email: 'admin@goldco.com.au',
    password: 'admin',
    role: 'admin',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'staff',
    name: 'Sales Staff',
    email: 'staff@goldco.com.au',
    password: 'staff',
    role: 'staff',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

export function listStaff(storage: Storage = workspaceStorage): StaffMember[] {
  try {
    const raw = storage.getItem(STAFF_KEY)
    if (!raw) return DEFAULT_STAFF
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStaffMember) : []
  } catch {
    return []
  }
}

function writeStaff(staff: StaffMember[], storage: Storage) {
  storage.setItem(STAFF_KEY, JSON.stringify(staff))
  notifyAuthChanged(storage)
}

export function findStaff(id: string, storage: Storage = workspaceStorage): StaffMember | undefined {
  return listStaff(storage).find((member) => member.id === id)
}

export type AddStaffResult = { ok: true; member: StaffMember } | { ok: false; error: string }

export function addStaff(
  input: { name: string; email: string; password: string; role: StaffRole },
  storage: Storage = workspaceStorage,
): AddStaffResult {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) return { ok: false, error: 'Enter a name.' }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email.' }
  if (input.password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' }
  const staff = listStaff(storage)
  if (staff.some((member) => member.email.toLowerCase() === email)) {
    return { ok: false, error: 'A staff member with this email already exists.' }
  }
  const member: StaffMember = {
    id: crypto.randomUUID(),
    name,
    email,
    password: input.password,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  }
  try {
    writeStaff([...staff, member], storage)
  } catch {
    return { ok: false, error: 'Could not save the staff account. Check browser storage and try again.' }
  }
  return { ok: true, member }
}

export function updateStaff(
  id: string,
  patch: Partial<Pick<StaffMember, 'role' | 'active'>>,
  storage: Storage = workspaceStorage,
): StaffMember[] {
  const staff = listStaff(storage)
  const next = staff.map((member) => (member.id === id ? { ...member, ...patch } : member))
  const activeAdmins = next.filter((member) => member.role === 'admin' && member.active)
  if (activeAdmins.length === 0) return staff
  writeStaff(next, storage)
  return next
}

export type SignInResult = { ok: true; session: StaffSession } | { ok: false; error: string }

export function signIn(
  email: string,
  password: string,
  portal: StaffRole,
  storage: Storage = workspaceStorage,
): SignInResult {
  const member = listStaff(storage).find((m) => m.email.toLowerCase() === email.trim().toLowerCase())
  if (!member || member.password !== password) return { ok: false, error: 'Email or password is incorrect.' }
  if (!member.active) return { ok: false, error: 'This account has been deactivated. Contact the office.' }
  if (portal === 'admin' && member.role !== 'admin') {
    return { ok: false, error: 'This account does not have admin access. Use staff sign-in instead.' }
  }
  const session: StaffSession = { staffId: member.id, role: portal, signedInAt: new Date().toISOString() }
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session))
    notifyAuthChanged(storage)
  } catch {
    return { ok: false, error: 'Could not save the sign-in session. Check browser storage and try again.' }
  }
  return { ok: true, session }
}

export function readSession(storage: Storage = workspaceStorage): StaffSession | null {
  try {
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StaffSession
    if (!session || typeof session.staffId !== 'string' || (session.role !== 'staff' && session.role !== 'admin') ||
        typeof session.signedInAt !== 'string' || !Number.isFinite(Date.parse(session.signedInAt))) return null
    const member = findStaff(session.staffId, storage)
    if (!member || !member.active) return null
    if (session.role === 'admin' && member.role !== 'admin') return null
    return session
  } catch {
    return null
  }
}

export function signOut(storage: Storage = workspaceStorage) {
  storage.removeItem(SESSION_KEY)
  notifyAuthChanged(storage)
}
