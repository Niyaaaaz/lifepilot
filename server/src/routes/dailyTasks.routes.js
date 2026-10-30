import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createDailyTasksController } from '../controllers/dailyTasks.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  completeRetakeSchema,
  createPersonalTaskSchema,
  dailyTaskIdParamsSchema,
  dailyTasksQuerySchema,
  updateTaskSchema,
} from '../validation/daily.validation.js'

export function createDailyTasksRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createDailyTasksController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)
  const validateTaskId = validateRequest({ params: dailyTaskIdParamsSchema })

  router.get('/', authenticate, validateRequest({ query: dailyTasksQuerySchema }), controller.list)
  router.post(
    '/',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ body: createPersonalTaskSchema }),
    controller.create,
  )
  router.patch(
    '/:taskId',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: dailyTaskIdParamsSchema, body: updateTaskSchema }),
    controller.update,
  )
  router.post(
    '/:taskId/retake',
    requireTrustedOrigin,
    authenticate,
    validateTaskId,
    controller.startRetake,
  )
  router.post(
    '/:taskId/retake/complete',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: dailyTaskIdParamsSchema, body: completeRetakeSchema }),
    controller.completeRetake,
  )
  router.delete(
    '/:taskId',
    requireTrustedOrigin,
    authenticate,
    validateTaskId,
    controller.delete,
  )

  return router
}

export default createDailyTasksRouter()
