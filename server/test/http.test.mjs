import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { app } from '../dist/src/app.js'
import { prisma } from '../dist/src/db.js'

test('API handles database failures without terminating the service', async (t) => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const originalSession = prisma.authSession.findUnique
  const originalWorkspace = prisma.workspaceRecord.findUnique
  prisma.workspaceRecord.findUnique = async () => null
  prisma.authSession.findUnique = async () => ({ user: { id:'admin', active:true, role:'admin' }, role:'admin', expiresAt:new Date(Date.now()+60000), tokenHash:'test' })
  const fetch = (url) => globalThis.fetch(url, { headers: { Authorization: `Bearer ${'a'.repeat(64)}` } })
  t.after(async () => {
    prisma.authSession.findUnique = originalSession
    prisma.workspaceRecord.findUnique = originalWorkspace
    await new Promise((resolve) => server.close(resolve))
    await prisma.$disconnect()
  })
  const originals = [prisma.$queryRaw, prisma.product.findMany, prisma.addon.findMany, prisma.colour.findMany, prisma.companySettings.findFirst]
  t.after(() => {
    [prisma.$queryRaw, prisma.product.findMany, prisma.addon.findMany, prisma.colour.findMany, prisma.companySettings.findFirst] = originals
  })
  const unavailable = async () => {
    throw new Prisma.PrismaClientInitializationError('private database details', '5.22.0', 'P1001')
  }
  prisma.$queryRaw = unavailable
  prisma.product.findMany = unavailable
  prisma.addon.findMany = unavailable
  prisma.colour.findMany = unavailable
  prisma.companySettings.findFirst = unavailable

  for (const route of ['/health/ready', '/api/v1/products', '/api/v1/addons', '/api/v1/colours', '/api/v1/company']) {
    await t.test(`${route} returns a safe JSON 503`, async () => {
      const res = await fetch(`${base}${route}`)
      assert.equal(res.status, 503)
      const body = await res.json()
      assert.equal(body.error.code, 'DATABASE_UNAVAILABLE')
      assert.equal(JSON.stringify(body).includes('private database details'), false)
      assert.equal((await fetch(`${base}/health`)).status, 200)
    })
  }
  await t.test('readiness recovers after the database returns', async () => {
    prisma.$queryRaw = async () => [{ '?column?': 1 }]
    const res = await fetch(`${base}/health/ready`)
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: true, database: 'ready' })
  })
  await t.test('unexpected errors return JSON 500 and unknown routes return JSON 404', async () => {
    prisma.addon.findMany = async () => { throw new Error('internal details') }
    const failed = await fetch(`${base}/api/v1/addons`)
    assert.equal(failed.status, 500)
    assert.equal((await failed.json()).error.code, 'INTERNAL_ERROR')
    const missing = await fetch(`${base}/api/v1/missing`)
    assert.equal(missing.status, 404)
    assert.equal((await missing.json()).error.code, 'NOT_FOUND')
  })
})
