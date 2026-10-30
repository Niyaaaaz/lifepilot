import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createGoalsController } from '../controllers/goals.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  goalBodySchema,
  goalIdParamsSchema,
  goalsEmptyQuerySchema,
} from '../validation/goals.validation.js'

export function createGoalsRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createGoalsController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)
  const validateId = validateRequest({ params: goalIdParamsSchema, query: goalsEmptyQuerySchema })
  const validateUpdate = validateRequest({
    params: goalIdParamsSchema,
    query: goalsEmptyQuerySchema,
    body: goalBodySchema,
  })

  router.get('/', authenticate, validateRequest({ query: goalsEmptyQuerySchema }), controller.list)
  router.post('/', requireTrustedOrigin, authenticate, validateRequest({ body: goalBodySchema }), controller.create)
  router.get('/:goalId', authenticate, validateId, controller.get)
  router.patch(
    '/:goalId',
    requireTrustedOrigin,
    authenticate,
    validateUpdate,
    controller.update,
  )
  router.delete('/:goalId', requireTrustedOrigin, authenticate, validateId, controller.delete)

  return router
}

export default createGoalsRouter()
