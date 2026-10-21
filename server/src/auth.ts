import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import type { StaffUser } from '@prisma/client'
import { prisma } from './db.js'
import { asyncHandler } from './http.js'
import { ApiError, check } from './apiError.js'
import { PASSWORD_HINT, validNewPassword } from './passwordPolicy.js'

const scrypt = promisify(scryptCallback)
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt:${salt}:${hash.toString('hex')}`
}
export async function verifyPassword(password: string, encoded: string | null) {
  const [method, salt, hex] = (encoded ?? '').split(':')
  if (method !== 'scrypt' || !salt || !hex || hex.length !== 128) return false
  const hash = (await scrypt(password, salt, 64)) as Buffer
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'))
}
export const publicStaff = (user: StaffUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt.toISOString(),
})
export interface Actor {
  user: StaffUser
  role: 'admin' | 'staff'
  tokenHash: string
}
export const actor = (res: Response) => res.locals.actor as Actor
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  check(token, 401, 'UNAUTHENTICATED', 'Please sign in again.')
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: true },
  })
  check(
    session &&
      session.expiresAt > new Date() &&
      session.user.active &&
      (session.role !== 'admin' || session.user.role === 'admin'),
    401,
    'UNAUTHENTICATED',
    'Your session expired or this account is no longer active.',
  )
  res.locals.actor = { user: session.user, role: session.role, tokenHash: session.tokenHash }
  check(
    !session.user.mustChangePassword ||
      ['/api/v1/auth/me', '/api/v1/auth/password', '/api/v1/auth/logout'].includes(
        req.originalUrl.split('?')[0],
      ),
    403,
    'PASSWORD_CHANGE_REQUIRED',
    'Change your temporary password before opening the shared workspace.',
  )
  next()
})
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (actor(res).role !== 'admin')
    return next(new ApiError(403, 'FORBIDDEN', 'Administrator access is required.'))
  next()
}
export const authRouter = Router()
const attempts = new Map<string, { count: number; until: number }>()
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, portal } = req.body ?? {}
    check(
      typeof email === 'string' &&
        email.length <= 254 &&
        typeof password === 'string' &&
        password.length <= 256 &&
        ['staff', 'admin'].includes(portal),
      400,
      'INVALID_LOGIN',
      'Enter a valid email, password and portal.',
    )
    const key = `${req.ip}:${email.trim().toLowerCase()}`
    const now = Date.now()
    if (attempts.size > 10000)
      for (const [id, item] of attempts) if (item.until < now) attempts.delete(id)
    const attempt = attempts.get(key)
    check(
      !attempt || attempt.until < now || attempt.count < 15,
      429,
      'RATE_LIMIT',
      'Too many sign-in attempts. Try again in 15 minutes.',
    )
    const user = await prisma.staffUser.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (
      !user?.active ||
      !(await verifyPassword(password, user.passwordHash)) ||
      (portal === 'admin' && user.role !== 'admin')
    ) {
      attempts.set(key, {
        count: attempt && attempt.until > now ? attempt.count + 1 : 1,
        until: attempt && attempt.until > now ? attempt.until : now + 900000,
      })
      throw new ApiError(
        401,
        'INVALID_LOGIN',
        'Email, password or portal is incorrect, or the account is inactive.',
      )
    }
    attempts.delete(key)
    const token = randomBytes(32).toString('hex')
    const signedInUser = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      const latest = await tx.staffUser.findUnique({ where: { id: user.id } })
      check(
        latest?.active &&
          latest.passwordHash === user.passwordHash &&
          (portal !== 'admin' || latest.role === 'admin'),
        401,
        'INVALID_LOGIN',
        'This account changed while signing in. Try again.',
      )
      await tx.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      await tx.authSession.create({
        data: {
          tokenHash: digest(token),
          userId: latest.id,
          role: portal,
          expiresAt: new Date(now + 7 * 86400000),
        },
      })
      return latest
    })
    res.json({
      token,
      user: publicStaff(signedInUser),
      session: { staffId: user.id, role: portal, signedInAt: new Date().toISOString() },
    })
  }),
)
authRouter.get('/me', requireAuth, (_req, res) => {
  const current = actor(res)
  res.json({
    user: publicStaff(current.user),
    session: { staffId: current.user.id, role: current.role, signedInAt: new Date().toISOString() },
  })
})
authRouter.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = actor(res)
    const { currentPassword, newPassword } = req.body ?? {}
    check(
      typeof currentPassword === 'string' && currentPassword.length <= 256,
      400,
      'INVALID_PASSWORD',
      'Enter your current password.',
    )
    check(validNewPassword(newPassword), 400, 'WEAK_PASSWORD', PASSWORD_HINT)
    check(
      await verifyPassword(currentPassword, current.user.passwordHash),
      400,
      'INCORRECT_PASSWORD',
      'Current password is incorrect.',
    )
    check(
      currentPassword !== newPassword,
      400,
      'PASSWORD_UNCHANGED',
      'Choose a different password.',
    )
    const passwordHash = await hashPassword(newPassword)
    const user = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      const latest = await tx.staffUser.findUnique({ where: { id: current.user.id } })
      const session = await tx.authSession.findUnique({ where: { tokenHash: current.tokenHash } })
      check(
        latest?.active &&
          latest.passwordHash === current.user.passwordHash &&
          session &&
          session.expiresAt > new Date(),
        409,
        'ACCOUNT_CHANGED',
        'Your account changed. Sign in again before changing the password.',
      )
      const updated = await tx.staffUser.update({
        where: { id: latest.id },
        data: { passwordHash, mustChangePassword: false },
      })
      await tx.authSession.deleteMany({
        where: { userId: latest.id, tokenHash: { not: current.tokenHash } },
      })
      await tx.workspaceClock.update({
        where: { id: 'main' },
        data: { revision: { increment: 1 } },
      })
      return updated
    })
    res.json({ user: publicStaff(user) })
  }),
)
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (_req, res) => {
    await prisma.authSession.deleteMany({ where: { tokenHash: actor(res).tokenHash } })
    res.json({ ok: true })
  }),
)

export const staffRouter = Router()
staffRouter.use(requireAuth, requireAdmin)
staffRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const members = req.body?.members
    check(
      Array.isArray(members) && members.length <= 200,
      400,
      'INVALID_STAFF',
      'Invalid staff import.',
    )
    const prepared: Array<{
      id: string
      name: string
      email: string
      passwordHash: string
      role: string
      active: boolean
    }> = []
    for (const member of members) {
      check(
        typeof member.id === 'string' &&
          member.id.length <= 100 &&
          typeof member.name === 'string' &&
          member.name.trim() &&
          typeof member.email === 'string' &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email) &&
          typeof member.password === 'string' &&
          member.password.length >= 4 &&
          member.password.length <= 256 &&
          ['staff', 'admin'].includes(member.role) &&
          typeof member.active === 'boolean',
        400,
        'INVALID_STAFF',
        'An older staff account has invalid details. Add it manually from Staff.',
      )
      prepared.push({
        id: member.id,
        name: member.name,
        email: member.email.toLowerCase(),
        passwordHash: await hashPassword(member.password),
        role: member.role,
        active: member.active,
      })
    }
    const count = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      let added = 0
      for (const member of prepared)
        if (
          !(await tx.staffUser.findFirst({
            where: { OR: [{ id: member.id }, { email: member.email }] },
          }))
        ) {
          await tx.staffUser.create({ data: { ...member, mustChangePassword: true } })
          added++
        }
      if (added)
        await tx.workspaceClock.update({
          where: { id: 'main' },
          data: { revision: { increment: 1 } },
        })
      return added
    })
    res.json({ imported: count })
  }),
)
staffRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body ?? {}
    check(
      typeof name === 'string' &&
        name.trim() &&
        name.length <= 100 &&
        typeof email === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        email.length <= 254 &&
        typeof password === 'string' &&
        ['staff', 'admin'].includes(role),
      400,
      'INVALID_STAFF',
      'Enter a name, valid email and role.',
    )
    check(validNewPassword(password), 400, 'WEAK_PASSWORD', PASSWORD_HINT)
    const passwordHash = await hashPassword(password)
    try {
      const user = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
        const created = await tx.staffUser.create({
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            passwordHash,
            role,
            mustChangePassword: true,
          },
        })
        await tx.workspaceClock.update({
          where: { id: 'main' },
          data: { revision: { increment: 1 } },
        })
        return created
      })
      res.status(201).json({ member: publicStaff(user) })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ApiError(409, 'EMAIL_EXISTS', 'A staff member with this email already exists.')
      throw error
    }
  }),
)
staffRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const current = actor(res)
    const { currentPassword, newPassword } = req.body ?? {}
    check(
      req.params.id !== current.user.id,
      400,
      'USE_PASSWORD_CHANGE',
      'Use My account to change your own password.',
    )
    check(validNewPassword(newPassword), 400, 'WEAK_PASSWORD', PASSWORD_HINT)
    check(
      typeof currentPassword === 'string' &&
        currentPassword.length <= 256 &&
        (await verifyPassword(currentPassword, current.user.passwordHash)),
      400,
      'INCORRECT_PASSWORD',
      'Your current administrator password is incorrect.',
    )
    const passwordHash = await hashPassword(newPassword)
    const member = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      const admin = await tx.staffUser.findUnique({ where: { id: current.user.id } })
      const session = await tx.authSession.findUnique({ where: { tokenHash: current.tokenHash } })
      check(
        admin?.active &&
          admin.role === 'admin' &&
          admin.passwordHash === current.user.passwordHash &&
          session &&
          session.expiresAt > new Date(),
        403,
        'FORBIDDEN',
        'Your administrator session changed. Sign in again.',
      )
      const target = await tx.staffUser.findUnique({ where: { id: req.params.id } })
      check(target, 404, 'NOT_FOUND', 'Staff member not found.')
      check(
        !(await verifyPassword(newPassword, target.passwordHash)),
        400,
        'PASSWORD_UNCHANGED',
        'Choose a different temporary password.',
      )
      const updated = await tx.staffUser.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true },
      })
      await tx.authSession.deleteMany({ where: { userId: target.id } })
      await tx.workspaceClock.update({
        where: { id: 'main' },
        data: { revision: { increment: 1 } },
      })
      return updated
    })
    res.json({ member: publicStaff(member) })
  }),
)
staffRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { role, active } = req.body ?? {}
    check(
      (role === undefined || ['staff', 'admin'].includes(role)) &&
        (active === undefined || typeof active === 'boolean'),
      400,
      'INVALID_STAFF',
      'Invalid role or active status.',
    )
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
      const existing = await tx.staffUser.findUnique({ where: { id: req.params.id } })
      check(existing, 404, 'NOT_FOUND', 'Staff member not found.')
      const next = { role: role ?? existing.role, active: active ?? existing.active }
      if (existing.role === 'admin' && existing.active && (next.role !== 'admin' || !next.active)) {
        check(
          (await tx.staffUser.count({ where: { active: true, role: 'admin' } })) > 1,
          409,
          'LAST_ADMIN',
          'At least one active admin is required.',
        )
      }
      const result = await tx.staffUser.update({ where: { id: existing.id }, data: next })
      if (!next.active || next.role !== existing.role)
        await tx.authSession.deleteMany({ where: { userId: existing.id } })
      await tx.workspaceClock.update({
        where: { id: 'main' },
        data: { revision: { increment: 1 } },
      })
      return result
    })
    res.json({ member: publicStaff(updated) })
  }),
)
