import { getPrismaClient } from '../config/database.js'
import { getDatabaseHealth } from '../services/databaseHealth.service.js'

export function createDatabaseHealthController(prismaProvider = getPrismaClient) {
  return async function databaseHealthController(_request, response) {
    response.status(200).json(await getDatabaseHealth(prismaProvider))
  }
}
