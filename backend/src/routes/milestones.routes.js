import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createMilestonesController } from '../controllers/milestones.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  accountEmptyQuerySchema,
  createMilestoneBodySchema,
  goalMilestoneParamsSchema,
  milestoneParamsSchema,
  updateMilestoneBodySchema,
} from '../validation/account.validation.js'

export function createMilestonesRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createMilestonesController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)

  router.get(
    '/goals/:goalId/milestones',
    authenticate,
    validateRequest({ params: goalMilestoneParamsSchema, query: accountEmptyQuerySchema }),
    controller.list,
  )
  router.post(
    '/goals/:goalId/milestones',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: goalMilestoneParamsSchema, query: accountEmptyQuerySchema, body: createMilestoneBodySchema }),
    controller.create,
  )
  router.patch(
    '/milestones/:milestoneId',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: milestoneParamsSchema, query: accountEmptyQuerySchema, body: updateMilestoneBodySchema }),
    controller.update,
  )
  router.delete(
    '/milestones/:milestoneId',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: milestoneParamsSchema, query: accountEmptyQuerySchema }),
    controller.delete,
  )
  return router
}
