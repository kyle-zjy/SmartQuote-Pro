import { app } from './app.js'
import { prisma } from './db.js'
const port = Number(process.env.PORT ?? 3001)

const server = app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  const timeout = setTimeout(() => process.exit(1), 10_000)
  timeout.unref()
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0)).catch(() => process.exit(1))
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
