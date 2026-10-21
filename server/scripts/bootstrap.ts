import { prisma } from '../src/db.js'
import { hashPassword } from '../src/auth.js'
import { validNewPassword, PASSWORD_HINT } from '../src/passwordPolicy.js'
import { COMPANY, PRODUCT_WARRANTY_NOTES } from '../../src/data/company.ts'
import { readFile } from 'node:fs/promises'
try {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.INITIAL_ADMIN_PASSWORD || !process.env.INITIAL_STAFF_PASSWORD)
  )
    throw new Error(
      'Set INITIAL_ADMIN_PASSWORD and INITIAL_STAFF_PASSWORD before production bootstrap.',
    )
  for (const item of [
    {
      id: 'admin',
      name: 'Office Admin',
      email: process.env.INITIAL_ADMIN_EMAIL ?? 'admin@goldco.com.au',
      role: 'admin',
      password: process.env.INITIAL_ADMIN_PASSWORD ?? 'admin',
    },
    {
      id: 'staff',
      name: 'Sales Staff',
      email: process.env.INITIAL_STAFF_EMAIL ?? 'staff@goldco.com.au',
      role: 'staff',
      password: process.env.INITIAL_STAFF_PASSWORD ?? 'staff',
    },
  ]) {
    const existing = await prisma.staffUser.findUnique({ where: { email: item.email } })
    if (!existing) {
      const { password, ...data } = item
      if (process.env.NODE_ENV === 'production' && !validNewPassword(password)) throw new Error(PASSWORD_HINT)
      await prisma.staffUser.create({
        data: { ...data, passwordHash: await hashPassword(password) },
      })
    }
  }
  await prisma.workspaceClock.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} })
  const pricing = JSON.parse(
    await readFile(new URL('../../src/data/pricing.json', import.meta.url), 'utf8'),
  )
  const addons = JSON.parse(
    await readFile(new URL('../../src/data/addons.json', import.meta.url), 'utf8'),
  )
  for (const [id, value] of Object.entries({
    company: COMPANY,
    pricing: { data: pricing, addons, source: 'default', fileName: null },
    warranty: PRODUCT_WARRANTY_NOTES,
  })) {
    await prisma.workspaceRecord.upsert({ where: { id }, create: { id, value }, update: {} })
  }
  console.log('Shared workspace initialized; existing accounts and records preserved.')
} finally {
  await prisma.$disconnect()
}
