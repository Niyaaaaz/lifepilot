import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createDatabaseHealthController } from '../controllers/databaseHealth.controller.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { healthQuerySchema } from '../validation/health.validation.js'

export function createDatabaseHealthRouter({ prismaProvider = getPrismaClient } = {}) {
  const router = Router()
  const controller = createDatabaseHealthController(prismaProvider)

  router.get('/', validateRequest({ query: healthQuerySchema }), controller)
  return router
}

export default createDatabaseHealthRouter()
