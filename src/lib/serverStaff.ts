import { api, SERVER_MODE } from './apiClient'
import {
  addStaff,
  updateStaff,
  listStaff,
  type StaffMember,
  type AddStaffResult,
} from './staffStore'
import { refreshWorkspace, serializeServer, reportSyncError } from './serverWorkspace'
import { workspaceStorage } from './workspaceStorage'
import { STAFF_KEY, AUTH_CHANGED_EVENT } from './staffStore'
import { validNewPassword, PASSWORD_HINT } from '../../server/src/passwordPolicy'

export async function changeOwnPassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<StaffMember> {
  if (!validNewPassword(newPassword)) throw new Error(PASSWORD_HINT)
  if (SERVER_MODE)
    return (
      await api<{ user: StaffMember }>('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    ).user
  const member = listStaff().find((m) => m.id === id)
  if (!member || member.password !== currentPassword)
    throw new Error('Current password is incorrect.')
  if (currentPassword === newPassword) throw new Error('Choose a different password.')
  const updated = { ...member, password: newPassword, mustChangePassword: false }
  workspaceStorage.setItem(
    STAFF_KEY,
    JSON.stringify(listStaff().map((m) => (m.id === id ? updated : m))),
  )
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
  return updated
}
export async function resetStaffPassword(id: string, currentPassword: string, newPassword: string) {
  await api(`/staff/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
export async function createStaff(input: {
  name: string
  email: string
  password: string
  role: 'admin' | 'staff'
}): Promise<AddStaffResult> {
  if (!SERVER_MODE) return addStaff(input)
  try {
    const result = await api<{ member: StaffMember }>('/staff', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    workspaceStorage.setItem(
      STAFF_KEY,
      JSON.stringify([...listStaff(), { ...result.member, password: '' }]),
    )
    await serializeServer(() => refreshWorkspace(true)).catch(reportSyncError)
    return { ok: true, member: result.member }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create this staff account.',
    }
  }
}
export async function changeStaff(
  id: string,
  patch: Partial<Pick<StaffMember, 'role' | 'active'>>,
): Promise<StaffMember[]> {
  if (!SERVER_MODE) return updateStaff(id, patch)
  const result = await api<{ member: StaffMember }>(`/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  workspaceStorage.setItem(
    STAFF_KEY,
    JSON.stringify(
      listStaff().map((member) => (member.id === id ? { ...result.member, password: '' } : member)),
    ),
  )
  await serializeServer(() => refreshWorkspace(true)).catch(reportSyncError)
  return listStaff()
}
