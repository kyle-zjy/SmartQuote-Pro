import { Router } from 'express'
import { prisma } from '../db.js'

export const coloursRouter = Router()

coloursRouter.get('/', async (req, res) => {
  const productKey = typeof req.query.productKey === 'string' ? req.query.productKey : undefined

  const colours = await prisma.colour.findMany({
    orderBy: { name: 'asc' },
    include: { colourProducts: { include: { product: true } } },
  })

  const items = colours
    .filter((colour) => {
      if (!productKey) return true
      if (colour.colourProducts.length === 0) return true // e.g. "Non-standard / Other" applies to every product
      return colour.colourProducts.some((cp) => cp.product.key === productKey)
    })
    .map((colour) => ({
      name: colour.name,
      additionalCharge: colour.additionalCharge,
      products: colour.colourProducts.map((cp) => cp.product.key),
    }))

  res.json({ items, total: items.length })
})
