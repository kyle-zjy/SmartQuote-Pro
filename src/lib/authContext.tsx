import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  findStaff,
  readSession,
  signIn as storeSignIn,
  signOut as storeSignOut,
  type SignInResult,
  type StaffMember,
  type StaffRole,
  type StaffSession,
} from './staffStore'

interface AuthContextValue {
  session: StaffSession | null
  user: StaffMember | null
  isAdmin: boolean
  signIn: (email: string, password: string, portal: StaffRole) => SignInResult
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function safeReadSession(): StaffSession | null {
  try {
    return readSession()
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(safeReadSession)

  const signIn = useCallback((email: string, password: string, portal: StaffRole) => {
    const result = storeSignIn(email, password, portal)
    if (result.ok) setSession(result.session)
    return result
  }, [])

  const signOut = useCallback(() => {
    try {
      storeSignOut()
    } catch {
      // Storage unavailable; clearing in-memory session is enough.
    }
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session ? (findStaff(session.staffId) ?? null) : null
    return { session, user, isAdmin: session?.role === 'admin', signIn, signOut }
  }, [session, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
