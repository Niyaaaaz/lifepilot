import { randomUUID } from 'node:crypto'
import { disconnectDatabase, getPrismaClient } from '../config/database.js'

try {
  const prisma = getPrismaClient()
  const checkId = `lifepilot-connection-check-${randomUUID()}`
  const created = await prisma.mongoConnectionCheck.create({ data: { checkId } })
  const retrieved = await prisma.mongoConnectionCheck.findUnique({ where: { checkId } })

  if (!retrieved || retrieved.id !== created.id) {
    throw new Error('MongoDB record verification failed.')
  }

  console.log(JSON.stringify({
    status: 'ok',
    collection: 'database_connection_checks',
    recordId: retrieved.id,
    checkId: retrieved.checkId,
    createdAt: retrieved.createdAt.toISOString(),
  }))
} catch (error) {
  console.error(`MongoDB record test failed (${error.code || 'DATABASE_ERROR'}): ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDatabase().catch((error) => {
    console.error('Unable to close the MongoDB connection:', error)
    process.exitCode = 1
  })
}
