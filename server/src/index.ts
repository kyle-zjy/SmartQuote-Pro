import express from 'express'
import { productsRouter } from './routes/products.js'
import { addonsRouter } from './routes/addons.js'
import { coloursRouter } from './routes/colours.js'
import { companyRouter } from './routes/company.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/v1/products', productsRouter)
app.use('/api/v1/addons', addonsRouter)
app.use('/api/v1/colours', coloursRouter)
app.use('/api/v1/company', companyRouter)

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})
