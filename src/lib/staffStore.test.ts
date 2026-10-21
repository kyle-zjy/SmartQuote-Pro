import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY, STAFF_KEY, addStaff, listStaff, readSession, signIn, signOut, updateStaff } from './staffStore'
import { decideReview, getReview, readOwners, recordQuoteOwner, recordSubmission } from './reviewStore'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
})

describe('staffStore', () => {
  it('rejects malformed sessions and unknown portal roles', () => {
    for (const session of [null, {}, { staffId: 'staff', role: 'owner', signedInAt: '2026-10-21' }, { staffId: 'staff', role: 'staff', signedInAt: 'invalid' }]) {
      storage.setItem(SESSION_KEY, JSON.stringify(session))
      expect(readSession(storage)).toBeNull()
    }
  })

  it('does not reactivate default accounts when saved staff data is damaged', () => {
    for (const raw of ['null', '{}', '[null, {"id":"bad"}]', 'broken']) {
      storage.setItem(STAFF_KEY, raw)
      expect(listStaff(storage)).toEqual([])
      expect(signIn('admin@goldco.com.au', 'admin', 'admin', storage).ok).toBe(false)
    }
  })

  it('reports failed staff and session writes without signing in', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    expect(signIn('staff@goldco.com.au', 'staff', 'staff', storage)).toMatchObject({ ok: false, error: expect.stringMatching(/Could not save/) })
    expect(addStaff({ name: 'New', email: 'new@test.com', password: '1234', role: 'staff' }, storage)).toMatchObject({ ok: false })
    expect(readSession(storage)).toBeNull()
  })
  it('seeds a default admin and staff account', () => {
    expect(listStaff(storage).map((m) => m.role)).toEqual(['admin', 'staff'])
  })

  it('signs staff into the staff portal but refuses the admin portal', () => {
    expect(signIn('staff@goldco.com.au', 'staff', 'staff', storage).ok).toBe(true)
    const admin = signIn('staff@goldco.com.au', 'staff', 'admin', storage)
    expect(admin.ok).toBe(false)
  })

  it('lets an admin use either portal and keeps the chosen role in the session', () => {
    expect(signIn('ADMIN@goldco.com.au', 'admin', 'staff', storage).ok).toBe(true)
    expect(readSession(storage)?.role).toBe('staff')
    expect(signIn('admin@goldco.com.au', 'admin', 'admin', storage).ok).toBe(true)
    expect(readSession(storage)?.role).toBe('admin')
    signOut(storage)
    expect(readSession(storage)).toBeNull()
  })

  it('rejects wrong passwords', () => {
    expect(signIn('admin@goldco.com.au', 'nope', 'admin', storage)).toEqual({
      ok: false,
      error: 'Email or password is incorrect.',
    })
  })

  it('adds new staff who can then sign in, and rejects duplicate emails', () => {
    const result = addStaff({ name: 'Jo', email: 'jo@x.com', password: 'pass1', role: 'staff' }, storage)
    expect(result.ok).toBe(true)
    expect(signIn('jo@x.com', 'pass1', 'staff', storage).ok).toBe(true)
    expect(addStaff({ name: 'Jo 2', email: 'JO@x.com', password: 'pass1', role: 'staff' }, storage).ok).toBe(false)
  })

  it('blocks deactivated accounts and invalidates their session', () => {
    signIn('staff@goldco.com.au', 'staff', 'staff', storage)
    updateStaff('staff', { active: false }, storage)
    expect(readSession(storage)).toBeNull()
    expect(signIn('staff@goldco.com.au', 'staff', 'staff', storage).ok).toBe(false)
  })

  it('never removes the last active admin', () => {
    updateStaff('admin', { role: 'staff' }, storage)
    updateStaff('admin', { active: false }, storage)
    const admin = listStaff(storage).find((m) => m.id === 'admin')
    expect(admin).toMatchObject({ role: 'admin', active: true })
  })
})

describe('reviewStore', () => {
  it('records a submission and an admin decision on that revision', () => {
    recordSubmission('33021', 1, 'staff', storage)
    expect(getReview('33021', 1, storage)?.status).toBe('pending')
    decideReview('33021', 1, 'returned', 'admin', 'Check widths', storage)
    expect(getReview('33021', 1, storage)).toMatchObject({ status: 'returned', reviewNote: 'Check widths' })
    recordSubmission('33021', 1, 'staff', storage)
    const reopened = getReview('33021', 1, storage)
    expect(reopened?.status).toBe('pending')
    expect(reopened?.reviewNote).toBeUndefined()
  })

  it('keeps the first owner of a quote', () => {
    recordQuoteOwner('33021', 'staff', storage)
    recordQuoteOwner('33021', 'admin', storage)
    expect(readOwners(storage)['33021']).toBe('staff')
  })
})
