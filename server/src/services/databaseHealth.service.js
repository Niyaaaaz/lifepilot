import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

export async function getDatabaseHealth() {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`
    return { status: 'ok', database: 'postgresql' }
  } catch (error) {
    if (error instanceof HttpError) throw error
    console.error('Database health check failed:', error)
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is unavailable.')
  }
}
