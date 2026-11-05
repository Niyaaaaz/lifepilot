import app from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'

let server

async function startServer() {
  await connectDatabase()
  server = app.listen(env.PORT, () => {
    console.info(`LifePilot API listening on http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`)
  })
  server.on('error', (error) => {
    console.error('Unable to start the LifePilot API:', error)
    process.exitCode = 1
  })
}

startServer().catch(async (error) => {
  console.error('Unable to connect to MongoDB; the LifePilot API was not started:', error.message)
  try {
    await disconnectDatabase()
  } catch (disconnectError) {
    console.error('Error while disconnecting from MongoDB:', disconnectError)
  }
  process.exitCode = 1
})

function shutdown(signal) {
  console.info(`${signal} received; closing the LifePilot API.`)
  const closeServer = server
    ? new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    : Promise.resolve()
  closeServer.catch((error) => {
    console.error('Error while closing the LifePilot API:', error)
    process.exitCode = 1
  }).finally(() => {
    disconnectDatabase().catch((disconnectError) => {
      console.error('Error while disconnecting from the database:', disconnectError)
      process.exitCode = 1
    })
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
