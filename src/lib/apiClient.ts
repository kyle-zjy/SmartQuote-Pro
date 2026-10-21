export const SERVER_MODE =
  import.meta.env.MODE !== 'test' && import.meta.env.VITE_DATA_MODE !== 'local'
const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')
const TOKEN_KEY = 'smartquote-pro:api-token'
export const SERVER_DATA_EVENT = 'smartquote-pro:server-data'
export const SYNC_STATUS_EVENT = 'smartquote-pro:sync-status'
export function readToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}
export function storeToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}
export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(readToken() ? { Authorization: `Bearer ${readToken()}` } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(30000),
    })
  } catch {
    throw new ApiFailure(
      'Cannot reach the server. Your local edits are still here. Check the connection and try again.',
      0,
      'OFFLINE',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('smartquote-pro:session-expired'))
    throw new ApiFailure(
      data?.error?.message ?? `Server request failed (${response.status}).`,
      response.status,
      data?.error?.code ?? 'REQUEST_FAILED',
    )
  }
  if (!data)
    throw new ApiFailure(
      'The server did not return valid JSON. Check the API address.',
      502,
      'INVALID_RESPONSE',
    )
  return data as T
}
