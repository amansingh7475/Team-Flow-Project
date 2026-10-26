import { createServer } from 'node:http'
import { app } from './app.js'
import { connectDatabase } from './db.js'
import { env } from './config/env.js'
import { attachRealtime } from './realtime.js'
import { closeRealtime } from './realtime.js'
import { disconnectDatabase } from './db.js'

async function main() {
  await connectDatabase()
  const server = createServer(app)
  attachRealtime(server)
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal}; shutting down TeamFlow API`)
    await new Promise<void>(resolve => server.close(() => resolve()))
    await closeRealtime()
    await disconnectDatabase()
  }
  process.once('SIGTERM', () => { void shutdown('SIGTERM').finally(() => process.exit(0)) })
  process.once('SIGINT', () => { void shutdown('SIGINT').finally(() => process.exit(0)) })
  server.listen(env.PORT, () => console.log(`TeamFlow API listening on ${env.PORT}`))
}
main().catch(error => { console.error(error); process.exit(1) })
