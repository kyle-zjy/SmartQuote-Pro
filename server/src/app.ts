import express from 'express'
import { productsRouter } from './routes/products.js'
import { addonsRouter } from './routes/addons.js'
import { coloursRouter } from './routes/colours.js'
import { companyRouter } from './routes/company.js'
import { prisma } from './db.js'
import { asyncHandler, errorHandler } from './http.js'
import { authRouter, staffRouter, requireAuth } from './auth.js'
import { workspaceRouter } from './workspace.js'

export const app = express()
app.disable('x-powered-by')
app.use((req, res, next) => {
  const origin = req.headers.origin
  const allowed = (
    process.env.CORS_ORIGINS ??
    'http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173'
  ).split(',')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  }
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})
app.use(express.json({ limit: '30mb' }))
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/staff', staffRouter)
app.use('/api/v1/workspace', workspaceRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))
app.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, database: 'ready' })
  }),
)

app.use('/api/v1/products', requireAuth, productsRouter)
app.use('/api/v1/addons', requireAuth, addonsRouter)
app.use('/api/v1/colours', requireAuth, coloursRouter)
app.use('/api/v1/company', requireAuth, companyRouter)
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } })
})
app.use(errorHandler)
