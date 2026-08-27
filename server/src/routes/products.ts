import { Router } from 'express'
import { prisma } from '../db.js'

export const productsRouter = Router()

function toNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

async function serializeProduct(product: {
  key: string
  name: string
  pricingAsAt: Date | null
  note: string | null
  categories: {
    key: string
    label: string
    extraThresholdMm: number | null
    priceCells: { widthMm: number; heightMm: number; price: unknown }[]
    meshExtras: { name: string; underPrice: unknown; overPrice: unknown }[]
  }[]
}) {
  return {
    key: product.key,
    name: product.name,
    pricingAsAt: product.pricingAsAt ? product.pricingAsAt.toISOString().slice(0, 10) : null,
    note: product.note,
    categories: product.categories.map((category) => {
      const widths = [...new Set(category.priceCells.map((cell) => cell.widthMm))].sort((a, b) => a - b)
      const heights = [...new Set(category.priceCells.map((cell) => cell.heightMm))].sort((a, b) => a - b)
      const widthIndex = new Map(widths.map((w, i) => [w, i]))
      const heightIndex = new Map(heights.map((h, i) => [h, i]))

      const prices: (number | null)[][] = heights.map(() => widths.map(() => null))
      for (const cell of category.priceCells) {
        const hi = heightIndex.get(cell.heightMm)
        const wi = widthIndex.get(cell.widthMm)
        if (hi !== undefined && wi !== undefined) {
          prices[hi][wi] = toNumber(cell.price)
        }
      }

      return {
        key: category.key,
        label: category.label,
        widths,
        heights,
        prices,
        extras:
          category.meshExtras.length > 0
            ? {
                thresholdMm: category.extraThresholdMm,
                options: category.meshExtras.map((extra) => ({
                  name: extra.name,
                  under: toNumber(extra.underPrice),
                  over: toNumber(extra.overPrice),
                })),
              }
            : null,
      }
    }),
  }
}

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { categories: { include: { priceCells: true, meshExtras: true } } },
  })
  res.json({
    note: 'All prices exclude GST.',
    products: await Promise.all(products.map(serializeProduct)),
  })
})

productsRouter.get('/:key', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { key: req.params.key },
    include: { categories: { include: { priceCells: true, meshExtras: true } } },
  })
  if (!product) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `No product with key ${req.params.key}` } })
    return
  }
  res.json(await serializeProduct(product))
})
