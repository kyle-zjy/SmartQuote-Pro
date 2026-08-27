import { Router } from 'express'
import { prisma } from '../db.js'

export const addonsRouter = Router()

addonsRouter.get('/', async (_req, res) => {
  const addons = await prisma.addon.findMany({ orderBy: { name: 'asc' } })
  res.json({
    items: addons.map((addon) => ({
      section: addon.section,
      name: addon.name,
      price: addon.price === null ? null : Number(addon.price),
      priceOnRequest: addon.priceOnRequest,
      unit: addon.unit,
    })),
    total: addons.length,
  })
})
