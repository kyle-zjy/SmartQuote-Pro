import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  findStaff,
  AUTH_CHANGED_EVENT,
  SESSION_KEY,
  STAFF_KEY,
  readSession,
  signIn as storeSignIn,
  signOut as storeSignOut,
  type SignInResult,
  type StaffMember,
  type StaffRole,
  type StaffSession,
} from './staffStore'
import { api, readToken, SERVER_MODE, storeToken } from './apiClient'
import {
  initializeWorkspace,
  refreshWorkspace,
  reportSyncError,
  serializeServer,
} from './serverWorkspace'

interface AuthContextValue {
  session: StaffSession | null
  user: StaffMember | null
  isAdmin: boolean
  signIn: (email: string, password: string, portal: StaffRole) => Promise<SignInResult>
  signOut: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)
function safeReadSession() {
  try {
    return readSession()
  } catch {
    return null
  }
}
interface LoginResponse {
  token?: string
  user: StaffMember
  session: StaffSession
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() =>
    SERVER_MODE ? null : safeReadSession(),
  )
  const [serverUser, setServerUser] = useState<StaffMember | null>(null)
  const [ready, setReady] = useState(!SERVER_MODE)
  const [startupError, setStartupError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!SERVER_MODE) return
    let cancelled = false
    if (!readToken()) {
      setReady(true)
      return
    }
    void (async () => {
      try {
        const result = await api<LoginResponse>('/auth/me')
        if (!result.user.mustChangePassword) await initializeWorkspace()
        if (!cancelled) {
          setServerUser(result.user)
          setSession(result.session)
          setStartupError('')
          setReady(true)
        }
      } catch (error) {
        if (cancelled) return
        if ((error as { status?: number }).status === 401) {
          storeToken(null)
          setSession(null)
          setReady(true)
        } else
          setStartupError(
            error instanceof Error ? error.message : 'Could not connect to the workspace.',
          )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])
  useEffect(() => {
    if (!SERVER_MODE || !session || serverUser?.mustChangePassword) return
    let stopped = false
    const refresh = () => {
      void serializeServer(async () => {
        if (!stopped) await refreshWorkspace()
      }).catch(reportSyncError)
    }
    const expired = () => {
      storeToken(null)
      setSession(null)
      setServerUser(null)
    }
    const timer = window.setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    window.addEventListener('smartquote-pro:session-expired', expired)
    return () => {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('smartquote-pro:session-expired', expired)
    }
  }, [session, serverUser?.mustChangePassword])
  useEffect(() => {
    if (SERVER_MODE) return
    const refresh = () => setSession(safeReadSession())
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === SESSION_KEY || event.key === STAFF_KEY) refresh()
    }
    window.addEventListener('storage', changed)
    window.addEventListener('focus', refresh)
    window.addEventListener(AUTH_CHANGED_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh)
    }
  }, [])
  const signIn = useCallback(
    async (email: string, password: string, portal: StaffRole): Promise<SignInResult> => {
      try {
        if (SERVER_MODE) {
          const result = await api<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, portal }),
          })
          storeToken(result.token!)
          try {
            if (!result.user.mustChangePassword) await initializeWorkspace()
          } catch (error) {
            storeToken(null)
            throw error
          }
          setServerUser(result.user)
          setSession(result.session)
          return { ok: true, session: result.session }
        }
        const result = storeSignIn(email, password, portal)
        if (result.ok) setSession(result.session)
        return result
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not sign in.' }
      }
    },
    [],
  )
  const signOut = useCallback(() => {
    if (SERVER_MODE) {
      // Read the token before clearing it; fetch is created synchronously by api().
      void api('/auth/logout', { method: 'POST' }).catch(() => {})
      storeToken(null)
      setServerUser(null)
    } else {
      try {
        storeSignOut()
      } catch {
        /* Local session still ends. */
      }
    }
    setSession(null)
  }, [])
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { changeOwnPassword } = await import('./serverStaff')
      const updated = await changeOwnPassword(session!.staffId, currentPassword, newPassword)
      if (SERVER_MODE) {
        if (serverUser?.mustChangePassword) {
          try {
            await initializeWorkspace()
          } catch (error) {
            setStartupError(
              error instanceof Error ? error.message : 'Could not connect to the workspace.',
            )
            setReady(false)
          }
        }
        setServerUser(updated)
      }
    },
    [session, serverUser],
  )
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: SERVER_MODE ? serverUser : session ? (findStaff(session.staffId) ?? null) : null,
      isAdmin: session?.role === 'admin',
      signIn,
      signOut,
      changePassword,
    }),
    [session, serverUser, signIn, signOut, changePassword],
  )
  if (!ready)
    return (
      <main className="content">
        <p role="status">Connecting to the shared workspace…</p>
        {startupError && (
          <>
            <p role="alert">{startupError}</p>
            <button
              type="button"
              onClick={() => {
                setStartupError('')
                setAttempt((n) => n + 1)
              }}
            >
              Retry connection
            </button>
          </>
        )}
      </main>
    )
  return (
    <AuthContext.Provider value={value}>
      <Fragment key={SERVER_MODE ? (session?.signedInAt ?? 'signed-out') : 'local'}>
        {children}
      </Fragment>
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
