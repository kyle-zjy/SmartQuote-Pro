import type { Prisma } from '@prisma/client'
import { check } from './apiError.js'

interface ExtraOption {
  name: string
  under: number | null
  over: number | null
}
interface Category {
  key: string
  label: string
  widths: number[]
  heights: number[]
  prices: (number | null)[][]
  extras: { thresholdMm: number | null; options: ExtraOption[] } | null
}
interface Product {
  key: string
  name: string
  pricingAsAt: string | null
  note?: string | null
  categories: Category[]
}
interface Addon {
  section: string | null
  name: string
  price: number | null
  priceOnRequest: boolean
  unit: string | null
}
interface Catalog {
  data: { products: Product[] }
  addons: Addon[]
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && Boolean(value.trim()) && value.length <= max
const optionalText = (value: unknown, max = 200) =>
  value == null || (typeof value === 'string' && value.length <= max)
const amount = (value: unknown) =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 99_999_999.99 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.00001)
const dimension = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647
const identity = (item: { section?: unknown; name?: unknown }) =>
  JSON.stringify([item.section ?? null, item.name])
function valid(condition: unknown, detail: string): asserts condition {
  check(condition, 400, 'INVALID_PRICING', `Invalid price list: ${detail}`)
}

/** Validate the complete projection before issuing any catalog writes. */
export function validatePricingCatalog(value: unknown): Catalog {
  valid(
    object(value) &&
      object(value.data) &&
      Array.isArray(value.data.products) &&
      Array.isArray(value.addons),
    'products and add-ons are required.',
  )
  const products = value.data.products
  valid(products.length > 0 && products.length <= 100, 'provide between 1 and 100 products.')
  const productKeys = new Set<string>()
  let cellCount = 0
  for (const product of products) {
    valid(
      object(product) &&
        text(product.key, 100) &&
        text(product.name) &&
        optionalText(product.note, 10000) &&
        Array.isArray(product.categories) &&
        product.categories.length > 0 &&
        product.categories.length <= 100,
      'invalid product details.',
    )
    valid(!productKeys.has(product.key), `duplicate product key ${product.key}.`)
    productKeys.add(product.key)
    if (product.pricingAsAt != null) {
      const date =
        typeof product.pricingAsAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(product.pricingAsAt)
          ? new Date(`${product.pricingAsAt}T00:00:00.000Z`)
          : null
      valid(
        date &&
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === product.pricingAsAt,
        'pricing dates must use YYYY-MM-DD or null.',
      )
    }
    const categoryKeys = new Set<string>()
    for (const category of product.categories) {
      valid(
        object(category) && text(category.key, 100) && text(category.label),
        'invalid category details.',
      )
      valid(!categoryKeys.has(category.key), `duplicate category key ${category.key}.`)
      categoryKeys.add(category.key)
      for (const axis of [category.widths, category.heights])
        valid(
          Array.isArray(axis) &&
            axis.length > 0 &&
            axis.length <= 1000 &&
            axis.every(dimension) &&
            new Set(axis).size === axis.length,
          'sizes must be distinct positive whole numbers.',
        )
      const widths = category.widths as number[],
        heights = category.heights as number[]
      cellCount += widths.length * heights.length
      valid(cellCount <= 100000, 'the price list exceeds 100,000 size cells.')
      valid(
        Array.isArray(category.prices) &&
          category.prices.length === heights.length &&
          category.prices.every(
            (row) => Array.isArray(row) && row.length === widths.length && row.every(amount),
          ),
        'price matrix dimensions or amounts are invalid.',
      )
      if (category.extras != null) {
        const extras = category.extras
        valid(
          object(extras) &&
            (extras.thresholdMm == null ||
              (Number.isSafeInteger(extras.thresholdMm) &&
                Number(extras.thresholdMm) >= 0 &&
                Number(extras.thresholdMm) <= 2_147_483_647)) &&
            Array.isArray(extras.options) &&
            extras.options.length <= 1000,
          'invalid mesh extras.',
        )
        const names = new Set<string>()
        for (const extra of extras.options) {
          valid(
            object(extra) && text(extra.name) && amount(extra.under) && amount(extra.over),
            'invalid mesh extra price.',
          )
          valid(!names.has(extra.name), `duplicate mesh extra ${extra.name}.`)
          names.add(extra.name)
        }
      }
    }
  }
  valid(value.addons.length <= 5000, 'too many add-ons.')
  const addonKeys = new Set<string>()
  for (const addon of value.addons) {
    valid(
      object(addon) &&
        text(addon.name) &&
        optionalText(addon.section) &&
        optionalText(addon.unit) &&
        amount(addon.price) &&
        typeof addon.priceOnRequest === 'boolean',
      'invalid add-on details or amount.',
    )
    const key = identity(addon)
    valid(!addonKeys.has(key), `duplicate add-on ${addon.name} in the same section.`)
    addonKeys.add(key)
  }
  return value as unknown as Catalog
}

/** Caller owns the workspace advisory lock and the transaction containing pricing. */
export async function synchronizePricingCatalog(tx: Prisma.TransactionClient, value: unknown) {
  const catalog = validatePricingCatalog(value)
  const existingAddons = await tx.addon.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })
  const addonByIdentity = new Map<string, (typeof existingAddons)[number]>()
  for (const addon of existingAddons)
    if (!addonByIdentity.has(identity(addon))) addonByIdentity.set(identity(addon), addon)

  // Keep catalog identities and historical quote references. Removed entries are
  // retired rather than deleted; current catalog endpoints only expose active rows.
  await tx.product.updateMany({ where: { active: true }, data: { active: false } })
  await tx.productCategory.updateMany({ where: { active: true }, data: { active: false } })
  await tx.addon.updateMany({ where: { active: true }, data: { active: false } })
  for (const product of catalog.data.products) {
    const data = {
      name: product.name,
      pricingAsAt: product.pricingAsAt ? new Date(`${product.pricingAsAt}T00:00:00.000Z`) : null,
      note: product.note ?? null,
      active: true,
    }
    const saved = await tx.product.upsert({
      where: { key: product.key },
      create: { key: product.key, ...data },
      update: data,
    })
    for (const category of product.categories) {
      const data = {
        label: category.label,
        extraThresholdMm: category.extras?.thresholdMm ?? null,
        active: true,
      }
      const savedCategory = await tx.productCategory.upsert({
        where: { productId_key: { productId: saved.id, key: category.key } },
        create: { productId: saved.id, key: category.key, ...data },
        update: data,
      })
      await tx.priceCell.deleteMany({ where: { categoryId: savedCategory.id } })
      await tx.meshExtra.deleteMany({ where: { categoryId: savedCategory.id } })
      await tx.priceCell.createMany({
        data: category.heights.flatMap((heightMm, hi) =>
          category.widths.map((widthMm, wi) => ({
            categoryId: savedCategory.id,
            widthMm,
            heightMm,
            price: category.prices[hi][wi],
          })),
        ),
      })
      if (category.extras?.options.length)
        await tx.meshExtra.createMany({
          data: category.extras.options.map((extra) => ({
            categoryId: savedCategory.id,
            name: extra.name,
            underPrice: extra.under,
            overPrice: extra.over,
          })),
        })
    }
  }
  for (const addon of catalog.addons) {
    const data = {
      section: addon.section ?? null,
      name: addon.name,
      price: addon.price,
      priceOnRequest: addon.priceOnRequest,
      unit: addon.unit ?? null,
      active: true,
    }
    const existing = addonByIdentity.get(identity(addon))
    if (existing) await tx.addon.update({ where: { id: existing.id }, data })
    else await tx.addon.create({ data })
  }
}
