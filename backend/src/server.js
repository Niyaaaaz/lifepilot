import app from './app.js'
import { disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT, () => {
  console.info(`LifePilot API listening on http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`)
})

server.on('error', (error) => {
  console.error('Unable to start the LifePilot API:', error)
  process.exitCode = 1
})

function shutdown(signal) {
  console.info(`${signal} received; closing the LifePilot API.`)
  server.close((error) => {
    if (error) {
      console.error('Error while closing the LifePilot API:', error)
      process.exitCode = 1
    }
    disconnectDatabase().catch((disconnectError) => {
      console.error('Error while disconnecting from the database:', disconnectError)
      process.exitCode = 1
    })
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
