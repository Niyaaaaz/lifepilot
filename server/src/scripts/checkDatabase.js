import { disconnectDatabase } from '../config/database.js'
import { getDatabaseHealth } from '../services/databaseHealth.service.js'

try {
  const health = await getDatabaseHealth()
  console.log(JSON.stringify(health))
} catch (error) {
  console.error(`Database check failed (${error.code || 'DATABASE_ERROR'}): ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDatabase().catch((error) => {
    console.error('Unable to close the database connection:', error)
    process.exitCode = 1
  })
}
