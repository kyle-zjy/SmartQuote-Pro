import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { app } from '../dist/src/app.js'
import { prisma } from '../dist/src/db.js'
import { synchronizePricingCatalog, validatePricingCatalog } from '../dist/src/catalogSync.js'

const defaultCatalog = () => ({
  data: JSON.parse(readFileSync(new URL('../../src/data/pricing.json', import.meta.url), 'utf8')),
  addons: JSON.parse(readFileSync(new URL('../../src/data/addons.json', import.meta.url), 'utf8')),
  source: 'default',
  fileName: null,
})
test('price-list validation accepts the bundled catalog and rejects ambiguous or invalid data', () => {
  validatePricingCatalog(defaultCatalog())
  for (const mutate of [
    (v) => {
      v.data.products[0].categories[0].prices[0].pop()
    },
    (v) => {
      v.data.products[0].categories[0].prices[0][0] = -1
    },
    (v) => {
      v.data.products[0].categories[0].widths[1] = v.data.products[0].categories[0].widths[0]
    },
    (v) => {
      v.data.products[0].pricingAsAt = '2026-02-31'
    },
    (v) => {
      v.addons[0].price = 1.001
    },
    (v) => {
      v.addons.push(structuredClone(v.addons[0]))
    },
    (v) => {
      v.data.products.push(structuredClone(v.data.products[0]))
    },
    (v) => {
      v.data.products[2].categories[0].extras.options[0].over = -1
    },
  ]) {
    const value = defaultCatalog()
    mutate(value)
    assert.throws(
      () => validatePricingCatalog(value),
      (error) => error.code === 'INVALID_PRICING',
    )
  }
})

test(
  'shared price-list updates synchronize catalog tables atomically without rewriting history',
  { skip: process.env.RUN_DATABASE_TESTS !== '1' },
  async (t) => {
    assert.match(process.env.DATABASE_URL ?? '', /smartquote_integration_/)
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
    const login = async (role) => {
      const result = await request('/auth/login', null, 'POST', {
        email: `${role}@goldco.com.au`,
        password: role,
        portal: role,
      })
      assert.equal(result.status, 200)
      return result.body.token
    }
    const admin = await login('admin'),
      staff = await login('staff')
    const original = await prisma.workspaceRecord.findUniqueOrThrow({ where: { id: 'pricing' } })
    const prefix = `catalog-${crypto.randomUUID()}`
    const quoteId = `quote:${prefix}:v1`
    let historical
    const save = async (value, expected, token = admin) =>
      request('/workspace', token, 'PATCH', { changes: [{ id: 'pricing', value, expected }] })
    const currentPricing = () =>
      prisma.workspaceRecord.findUniqueOrThrow({ where: { id: 'pricing' } })
    const publicCatalog = async () => ({
      products: (await request('/products', admin)).body.products,
      addons: (await request('/addons', admin)).body.items,
    })
    try {
      const edited = structuredClone(original.value)
      const removedProduct = edited.data.products.pop()
      const firstProduct = edited.data.products[0]
      const removedCategory = firstProduct.categories.pop()
      const category = firstProduct.categories[0]
      const firstAddon = edited.addons[0]
      const removedAddon = edited.addons.pop()
      const productRow = await prisma.product.findUniqueOrThrow({
        where: { key: firstProduct.key },
      })
      const categoryRow = await prisma.productCategory.findUniqueOrThrow({
        where: { productId_key: { productId: productRow.id, key: category.key } },
      })
      const removedProductRow = await prisma.product.findUniqueOrThrow({
        where: { key: removedProduct.key },
      })
      const removedCategoryRow = await prisma.productCategory.findUniqueOrThrow({
        where: { productId_key: { productId: productRow.id, key: removedCategory.key } },
      })
      const addonRow = await prisma.addon.findFirstOrThrow({
        where: { name: firstAddon.name, section: firstAddon.section, active: true },
      })
      const removedAddonRow = await prisma.addon.findFirstOrThrow({
        where: { name: removedAddon.name, section: removedAddon.section, active: true },
      })
      historical = await prisma.quote.create({
        data: {
          quoteNo: prefix,
          quoteDate: new Date('2026-10-22'),
          status: 'issued',
          lines: {
            create: [
              {
                productId: removedProductRow.id,
                addonId: removedAddonRow.id,
                description: 'Captured historical price',
                unitPrice: 123.45,
              },
              {
                productId: productRow.id,
                categoryId: removedCategoryRow.id,
                description: 'Captured category price',
                unitPrice: 234.56,
              },
            ],
          },
        },
        include: { lines: { orderBy: { description: 'asc' } } },
      })
      const document = {
        quoteNo: prefix,
        version: 1,
        quote: {
          status: 'issued',
          items: [{ unitPrice: 123.45 }],
          issuedSnapshot: { total: 135.8 },
        },
      }
      await prisma.workspaceRecord.create({ data: { id: quoteId, value: document } })

      firstProduct.name = 'Updated product label'
      firstProduct.pricingAsAt = '2026-10-22'
      category.widths.pop()
      category.prices = category.prices.map((row) => row.slice(0, -1))
      category.prices[0][0] = 432.1
      const mesh = edited.data.products
        .find((p) => p.categories.some((c) => c.extras?.options.length))
        ?.categories.find((c) => c.extras?.options.length)
      assert.ok(mesh)
      mesh.extras.options[0].under = 42.5
      mesh.extras.options[0].over = null
      firstAddon.price = 199.95
      const addedAddon = {
        section: 'Extras',
        name: `${prefix}-repair`,
        price: null,
        priceOnRequest: true,
        unit: 'Each',
      }
      edited.addons.push(addedAddon)
      edited.data.products.push({
        key: prefix,
        name: 'New catalog product',
        pricingAsAt: null,
        categories: [
          {
            key: 'windows',
            label: 'Windows',
            widths: [400, 800],
            heights: [600, 900],
            prices: [
              [100, null],
              [200, 300],
            ],
            extras: null,
          },
        ],
      })
      edited.source = 'imported'
      edited.fileName = 'updated-prices.xlsx'

      await t.test(
        'import updates prices and both catalog APIs, preserving stable identities',
        async () => {
          const result = await save(edited, original.revision)
          assert.equal(result.status, 200, JSON.stringify(result.body))
          const catalog = await publicCatalog()
          assert.deepEqual(
            catalog.products.map((p) => p.key).sort(),
            edited.data.products.map((p) => p.key).sort(),
          )
          const product = catalog.products.find((p) => p.key === firstProduct.key)
          assert.equal(product.name, firstProduct.name)
          assert.equal(product.pricingAsAt, '2026-10-22')
          assert.deepEqual(product.categories, firstProduct.categories)
          const meshProduct = catalog.products.find(
            (p) => p.key === edited.data.products.find((p) => p.categories.includes(mesh)).key,
          )
          assert.deepEqual(
            meshProduct.categories.find((c) => c.key === mesh.key).extras,
            mesh.extras,
          )
          assert.deepEqual(catalog.products.find((p) => p.key === prefix).categories[0].prices, [
            [100, null],
            [200, 300],
          ])
          assert.deepEqual(
            catalog.addons.find((a) => a.name === addedAddon.name),
            addedAddon,
          )
          assert.equal(catalog.addons.find((a) => a.name === firstAddon.name).price, 199.95)
          assert.equal(
            (await prisma.product.findUniqueOrThrow({ where: { key: firstProduct.key } })).id,
            productRow.id,
          )
          assert.equal(
            (
              await prisma.productCategory.findUniqueOrThrow({
                where: { productId_key: { productId: productRow.id, key: category.key } },
              })
            ).id,
            categoryRow.id,
          )
          assert.equal(
            (
              await prisma.addon.findFirstOrThrow({
                where: { name: firstAddon.name, section: firstAddon.section, active: true },
              })
            ).id,
            addonRow.id,
          )
        },
      )
      await t.test(
        'removed catalog entries are hidden while historical records and links remain intact',
        async () => {
          assert.equal((await request(`/products/${removedProduct.key}`, admin)).status, 404)
          assert.equal(
            (await prisma.product.findUniqueOrThrow({ where: { id: removedProductRow.id } }))
              .active,
            false,
          )
          assert.equal(
            (
              await prisma.productCategory.findUniqueOrThrow({
                where: { id: removedCategoryRow.id },
              })
            ).active,
            false,
          )
          assert.equal(
            (await prisma.addon.findUniqueOrThrow({ where: { id: removedAddonRow.id } })).active,
            false,
          )
          assert.equal(
            (await publicCatalog()).addons.some((a) => a.name === removedAddon.name),
            false,
          )
          assert.deepEqual(
            (
              await prisma.quote.findUniqueOrThrow({
                where: { id: historical.id },
                include: { lines: { orderBy: { description: 'asc' } } },
              })
            ).lines,
            historical.lines,
          )
          assert.deepEqual(
            (await prisma.workspaceRecord.findUniqueOrThrow({ where: { id: quoteId } })).value,
            document,
          )
        },
      )
      await t.test(
        'staff, stale revisions and malformed matrices cannot partially update either representation',
        async () => {
          const before = await publicCatalog(),
            record = await currentPricing()
          assert.equal((await save(edited, record.revision, staff)).status, 403)
          assert.equal((await save(original.value, original.revision)).status, 409)
          const invalid = structuredClone(edited)
          invalid.data.products[0].categories[0].prices[0].pop()
          assert.equal((await save(invalid, record.revision)).status, 400)
          assert.deepEqual(await publicCatalog(), before)
          assert.deepEqual(await currentPricing(), record)
        },
      )
      await t.test(
        'a failure after catalog writes rolls back prices, revisions and the shared document together',
        async () => {
          const before = await publicCatalog(),
            record = await currentPricing()
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
              await synchronizePricingCatalog(tx, original.value)
              await tx.workspaceRecord.update({
                where: { id: 'pricing' },
                data: { value: original.value, revision: { increment: 1 } },
              })
              throw new Error('Simulated downstream failure')
            }),
            /Simulated downstream failure/,
          )
          assert.deepEqual(await publicCatalog(), before)
          assert.deepEqual(await currentPricing(), record)
        },
      )
      await t.test(
        'bootstrap reconciles the imported catalog instead of overwriting it with bundled defaults',
        async () => {
          const record = await currentPricing(),
            before = await publicCatalog()
          await prisma.addon.update({ where: { id: addonRow.id }, data: { price: 1 } })
          const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/bootstrap.ts'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)),
            env: process.env,
            encoding: 'utf8',
          })
          assert.equal(result.status, 0, result.stderr)
          assert.deepEqual((await currentPricing()).value, record.value)
          assert.deepEqual(await publicCatalog(), before)
        },
      )
      await t.test(
        'resetting defaults restores the catalog without duplicate add-ons or broken historical links',
        async () => {
          const before = await currentPricing()
          assert.equal((await save(original.value, before.revision)).status, 200)
          const catalog = await publicCatalog()
          assert.equal(catalog.products.length, original.value.data.products.length)
          assert.equal(catalog.addons.length, original.value.addons.length)
          assert.equal(
            (
              await prisma.addon.findFirstOrThrow({
                where: { name: firstAddon.name, section: firstAddon.section, active: true },
              })
            ).id,
            addonRow.id,
          )
          assert.equal(
            (await prisma.addon.findUniqueOrThrow({ where: { id: removedAddonRow.id } })).active,
            true,
          )
          assert.equal(
            (
              await prisma.productCategory.findUniqueOrThrow({
                where: { id: removedCategoryRow.id },
              })
            ).active,
            true,
          )
          assert.equal((await request(`/products/${prefix}`, admin)).status, 404)
          assert.deepEqual(
            (
              await prisma.quote.findUniqueOrThrow({
                where: { id: historical.id },
                include: { lines: { orderBy: { description: 'asc' } } },
              })
            ).lines,
            historical.lines,
          )
        },
      )
    } finally {
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(33021001)`
          await synchronizePricingCatalog(tx, original.value)
          await tx.workspaceRecord.update({
            where: { id: 'pricing' },
            data: { value: original.value, revision: { increment: 1 } },
          })
          await tx.workspaceClock.update({
            where: { id: 'main' },
            data: { revision: { increment: 1 } },
          })
        },
        { timeout: 30000 },
      )
      if (historical) await prisma.quote.delete({ where: { id: historical.id } })
      await prisma.workspaceRecord.deleteMany({ where: { id: quoteId } })
      await prisma.addon.deleteMany({ where: { name: `${prefix}-repair` } })
      await prisma.product.deleteMany({ where: { key: prefix } })
      await new Promise((resolve) => server.close(resolve))
      await prisma.$disconnect()
    }
  },
)
