import { test } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../dist/src/app.js'
import { prisma } from '../dist/src/db.js'
import { hashPassword, verifyPassword } from '../dist/src/auth.js'
import { validateQuote, reviewContent, canonical } from '../dist/src/workspace.js'

const q = (no) => ({
  quoteNo: no,
  quoteNumber: no,
  quoteDate: '2026-10-21',
  version: 1,
  status: 'draft',
  dealStatus: 'open',
  items: [
    {
      id: 'line',
      description: 'Door',
      detail: '',
      room: 'Living',
      note: '',
      unitPrice: 650,
      finalPrice: 650,
      quantity: 1,
    },
  ],
  gstEnabled: true,
  roomPhotos: {},
  customer: { name: 'API test customer', address: '1 Test Street', phone: '0400000000', email: '' },
  shipSameAsBill: true,
  shipTo: { name: '', address: '', phone: '', email: '' },
  frameColour: 'White',
  customFrameColour: '',
  colourExtraOverride: null,
  paid: 0,
  issuedSnapshot: null,
})
const archive = (quote) => ({
  quoteNo: quote.quoteNo,
  version: 1,
  quote,
  total: 0,
  itemCount: 1,
  photosOmitted: false,
  comments: [],
  savedAt: new Date().toISOString(),
})
test('passwords are salted and validated without plaintext storage', async () => {
  const first = await hashPassword('test password'),
    second = await hashPassword('test password')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('test password', first), true)
  assert.equal(await verifyPassword('wrong', first), false)
  assert.equal(await verifyPassword('anything', 'invalid'), false)
})
test('quote validation rejects invalid quantities, negative prices and unsafe image URLs', () => {
  validateQuote(q('test'))
  const negative = q('test')
  negative.items[0].unitPrice = -1
  assert.throws(() => validateQuote(negative))
  const quantity = q('test')
  quantity.items[0].quantity = 1.5
  assert.throws(() => validateQuote(quantity))
  const image = q('test')
  image.roomPhotos = { Living: [{ id: 'photo', caption: '', dataUrl: 'javascript:alert(1)' }] }
  assert.throws(() => validateQuote(image))
})
test('review fingerprint ignores images and payments while binding commercial content', () => {
  const original = q('test'),
    terms = { colourExtra: 0, depositRate: 0.5 }
  const changed = structuredClone(original)
  changed.paid = 100
  changed.roomPhotos = { Living: [] }
  assert.equal(reviewContent(original, terms), reviewContent(changed, terms))
  changed.items[0].unitPrice = 700
  assert.notEqual(reviewContent(original, terms), reviewContent(changed, terms))
})

test(
  'authenticated workspace persists atomic, permission-checked revisions in PostgreSQL',
  { skip: process.env.RUN_DATABASE_TESTS !== '1' },
  async (t) => {
    assert.match(
      process.env.DATABASE_URL ?? '',
      /smartquote_integration_/,
      'Use only the dedicated integration database',
    )
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}/api/v1`
    const request = async (path, token, method = 'GET', body) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json() }
    }
    const prefix = `api-${crypto.randomUUID()}`
    const createdIds = []
    t.after(async () => {
      await prisma.workspaceRecord.deleteMany({ where: { id: { in: createdIds } } })
      await prisma.staffUser.deleteMany({ where: { email: { startsWith: prefix } } })
      await new Promise((resolve) => server.close(resolve))
      await prisma.$disconnect()
    })
    const login = async (role) => {
      const response = await request('/auth/login', null, 'POST', {
        email: `${role}@goldco.com.au`,
        password: role,
        portal: role,
      })
      assert.equal(response.status, 200)
      assert.equal('passwordHash' in response.body.user, false)
      assert.equal('password' in response.body.user, false)
      return response.body.token
    }
    const staff = await login('staff'),
      admin = await login('admin')
    const keys = (no) => ({
      quote: `quote:${encodeURIComponent(no)}:v1`,
      review: `review:${encodeURIComponent(no)}:v1`,
      draft: `draft:${encodeURIComponent(no)}:v1`,
    })
    const snapshot = async (token) => (await request('/workspace', token)).body
    const patch = async (token, changes) => await request('/workspace', token, 'PATCH', { changes })
    const change = (id, expected, value) => ({ id, expected, value })
    await t.test(
      'unauthenticated and forged browser sessions cannot access shared data',
      async () => {
        assert.equal((await request('/workspace')).status, 401)
        assert.equal((await request('/workspace', '0'.repeat(64))).status, 401)
        assert.equal(
          (
            await request('/staff', staff, 'POST', {
              name: 'Invalid',
              email: `${prefix}@test.local`,
              password: 'test',
              role: 'admin',
            })
          ).status,
          403,
        )
      },
    )
    const no = `${prefix}-quote`,
      ids = keys(no),
      draft = q(no)
    createdIds.push(...Object.values(ids), `owner:${encodeURIComponent(no)}`)
    await t.test(
      'saves a quote with server-calculated totals and no password exposure',
      async () => {
        const result = await patch(staff, [change(ids.quote, 0, archive(draft))])
        assert.equal(result.status, 200)
        assert.equal(result.body.records.find((r) => r.id === ids.quote).value.total, 715)
        const state = await snapshot(staff)
        assert.ok(state.records.some((r) => r.id === ids.quote))
        assert.ok(state.staff.every((u) => !('password' in u) && !('passwordHash' in u)))
      },
    )
    await t.test(
      'stale revisions and multi-record partial failures never overwrite committed data',
      async () => {
        const original = await prisma.workspaceRecord.findUnique({ where: { id: ids.quote } })
        const modified = archive({ ...draft, customer: { ...draft.customer, name: 'Stale edit' } })
        assert.equal((await patch(staff, [change(ids.quote, 0, modified)])).status, 409)
        const invalid = q(no)
        invalid.items[0].quantity = -1
        const result = await patch(staff, [
          change(ids.quote, original.revision, modified),
          change(ids.draft, 0, invalid),
        ])
        assert.equal(result.status, 400)
        assert.deepEqual(
          (await prisma.workspaceRecord.findUnique({ where: { id: ids.quote } })).value,
          original.value,
        )
        assert.equal(await prisma.workspaceRecord.findUnique({ where: { id: ids.draft } }), null)
      },
    )
    let review
    await t.test(
      'staff can submit but cannot approve or issue their own unapproved quote',
      async () => {
        const original = await prisma.workspaceRecord.findUnique({ where: { id: ids.quote } })
        const submitted = { ...draft, status: 'office-review' }
        const result = await patch(staff, [
          change(ids.quote, original.revision, archive(submitted)),
          change(ids.review, 0, {
            quoteNo: no,
            version: 1,
            status: 'pending',
            submittedBy: 'forged',
            submittedAt: 'old',
            contentKey: 'forged',
          }),
        ])
        assert.equal(result.status, 200)
        review = result.body.records.find((r) => r.id === ids.review)
        assert.equal(review.value.submittedBy, 'staff')
        assert.equal(
          review.value.contentKey,
          reviewContent(submitted, { colourExtra: 0, depositRate: 0.5 }),
        )
        assert.equal(
          (
            await patch(staff, [
              change(ids.review, review.revision, { ...review.value, status: 'approved' }),
            ])
          ).status,
          403,
        )
        const latest = await prisma.workspaceRecord.findUnique({ where: { id: ids.quote } })
        assert.equal(
          (
            await patch(staff, [
              change(
                ids.quote,
                latest.revision,
                archive({ ...submitted, status: 'issued', issuedSnapshot: {} }),
              ),
            ])
          ).status,
          403,
        )
      },
    )
    await t.test(
      'admin approval is persisted, allows issuing, and issued content is immutable',
      async () => {
        const approved = await patch(admin, [
          change(ids.review, review.revision, { ...review.value, status: 'approved' }),
        ])
        assert.equal(approved.status, 200)
        const latest = await prisma.workspaceRecord.findUnique({ where: { id: ids.quote } })
        const company = (await snapshot(admin)).records.find((r) => r.id === 'company').value
        const issued = {
          ...draft,
          status: 'issued',
          issuedSnapshot: {
            colourExtra: 0,
            gstEnabled: true,
            depositRate: 0.5,
            subtotal: 650,
            gstAmount: 65,
            total: 715,
            deposit: 357.5,
            issuedAt: new Date().toISOString(),
            document: { company, warrantyNotes: [] },
          },
        }
        const result = await patch(staff, [change(ids.quote, latest.revision, archive(issued))])
        assert.equal(result.status, 200)
        const record = result.body.records.find((r) => r.id === ids.quote)
        const tampered = structuredClone(record.value)
        tampered.quote.items[0].unitPrice = 1
        tampered.quote.items[0].finalPrice = 1
        assert.equal(
          (await patch(admin, [change(ids.quote, record.revision, tampered)])).status,
          409,
        )
        const paid = structuredClone(record.value)
        paid.quote.paid = 100
        assert.equal((await patch(staff, [change(ids.quote, record.revision, paid)])).status, 200)
      },
    )
    await t.test(
      'settings are admin-only; disabling a staff account invalidates its session',
      async () => {
        const state = await snapshot(admin),
          company = state.records.find((r) => r.id === 'company')
        assert.equal(
          (
            await patch(staff, [
              change('company', company.revision, { ...company.value, name: 'Unauthorised' }),
            ])
          ).status,
          403,
        )
        const created = await request('/staff', admin, 'POST', {
          name: 'Session test',
          email: `${prefix}@test.local`,
          password: 'Test-secret123',
          role: 'staff',
        })
        assert.equal(created.status, 201)
        const login = await request('/auth/login', null, 'POST', {
          email: `${prefix}@test.local`,
          password: 'Test-secret123',
          portal: 'staff',
        })
        assert.equal(login.status, 200)
        assert.equal(
          (await request(`/staff/${created.body.member.id}`, admin, 'PATCH', { active: false }))
            .status,
          200,
        )
        assert.equal((await request('/auth/me', login.body.token)).status, 401)
        const row = await prisma.staffUser.findUnique({ where: { id: created.body.member.id } })
        assert.ok(row.passwordHash.startsWith('scrypt:'))
        assert.equal(await verifyPassword('Test-secret123', row.passwordHash), true)
      },
    )
    await t.test(
      'password changes, administrator resets and temporary-password restrictions are enforced by the server',
      async () => {
        const email = `${prefix}-password@test.local`
        const create = (password) =>
          request('/staff', admin, 'POST', {
            name: 'Password test',
            email,
            password,
            role: 'staff',
          })
        assert.equal((await create('too-short1')).status, 400)
        const created = await create('Temporary-pass123')
        assert.equal(created.status, 201)
        assert.equal(created.body.member.mustChangePassword, true)
        const id = created.body.member.id
        const signIn = (password) =>
          request('/auth/login', null, 'POST', { email, password, portal: 'staff' })
        const initial = await signIn('Temporary-pass123')
        const token = initial.body.token
        assert.equal((await request('/workspace', token)).status, 403)
        assert.equal((await request('/auth/me', token)).status, 200)
        const update = (currentPassword, newPassword, session = token) =>
          request('/auth/password', session, 'POST', { currentPassword, newPassword })
        assert.equal((await update('wrong', 'Personal-pass123')).status, 400)
        assert.equal((await update('Temporary-pass123', 'weak')).status, 400)
        assert.equal((await update('Temporary-pass123', 'Temporary-pass123')).status, 400)
        const other = (await signIn('Temporary-pass123')).body.token
        const changed = await update('Temporary-pass123', 'Personal-pass123')
        assert.equal(changed.status, 200)
        assert.equal(changed.body.user.mustChangePassword, false)
        assert.equal('passwordHash' in changed.body.user, false)
        assert.equal((await request('/workspace', token)).status, 200)
        assert.equal((await request('/auth/me', other)).status, 401)
        assert.equal((await signIn('Temporary-pass123')).status, 401)
        assert.equal(
          (
            await request(`/staff/${id}/reset-password`, staff, 'POST', {
              currentPassword: 'staff',
              newPassword: 'Reset-pass123',
            })
          ).status,
          403,
        )
        assert.equal(
          (
            await request(`/staff/${id}/reset-password`, admin, 'POST', {
              currentPassword: 'wrong',
              newPassword: 'Reset-pass123',
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request('/staff/admin/reset-password', admin, 'POST', {
              currentPassword: 'admin',
              newPassword: 'Reset-pass123',
            })
          ).status,
          400,
        )
        const reset = await request(`/staff/${id}/reset-password`, admin, 'POST', {
          currentPassword: 'admin',
          newPassword: 'Reset-pass123',
        })
        assert.equal(reset.status, 200)
        assert.equal(reset.body.member.mustChangePassword, true)
        assert.equal((await request('/auth/me', token)).status, 401)
        assert.equal((await signIn('Personal-pass123')).status, 401)
        const resetLogin = await signIn('Reset-pass123')
        assert.equal(resetLogin.status, 200)
        assert.equal((await request('/workspace', resetLogin.body.token)).status, 403)
        assert.equal(
          (await update('Reset-pass123', 'Changed-again123', resetLogin.body.token)).status,
          200,
        )
        assert.equal((await request('/workspace', resetLogin.body.token)).status, 200)
      },
    )
    await t.test('server quote number allocation is unique across concurrent clients', async () => {
      const result = await Promise.all(
        Array.from({ length: 5 }, () => request('/workspace/number', staff, 'POST', {})),
      )
      assert.ok(result.every((r) => r.status === 200))
      const numbers = result.map((r) => r.body.quoteNo)
      assert.equal(new Set(numbers).size, 5)
      createdIds.push(...numbers.map((no) => `number:${no}`))
    })
    await t.test('logout revokes the server session', async () => {
      assert.equal((await request('/auth/logout', staff, 'POST')).status, 200)
      assert.equal((await request('/auth/me', staff)).status, 401)
    })
  },
)
