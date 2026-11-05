import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getPrismaClient } from '../config/database.js'
import { createTimetableController } from '../controllers/timetable.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  adjustTimetableSchema,
  generateTimetableSchema,
  timetableIdParamsSchema,
  timetableQuerySchema,
  updateTimetableSchema,
} from '../validation/timetable.validation.js'

export function createTimetableRouter({
  prismaProvider = getPrismaClient,
  requireAuth,
  limiterEnabled = true,
  aiGenerator,
  aiAdjuster,
} = {}) {
  const router = Router()
  const controller = createTimetableController(prismaProvider, { aiGenerator, aiAdjuster })
  const authenticate = requireAuth || createRequireAuth(prismaProvider)
  const validateId = validateRequest({ params: timetableIdParamsSchema })
  const aiLimiter = limiterEnabled
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'AI_RATE_LIMITED', message: 'Too many AI timetable requests. Try again in a few minutes.' } },
    })
    : (_request, _response, next) => next()

  router.post(
    '/generate',
    requireTrustedOrigin,
    aiLimiter,
    authenticate,
    validateRequest({ body: generateTimetableSchema }),
    controller.generate,
  )
  router.get('/', authenticate, validateRequest({ query: timetableQuerySchema }), controller.list)
  router.get('/:id', authenticate, validateId, controller.get)
  router.patch(
    '/:id',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: timetableIdParamsSchema, body: updateTimetableSchema }),
    controller.update,
  )
  router.post(
    '/:id/adjust',
    requireTrustedOrigin,
    aiLimiter,
    authenticate,
    validateRequest({ params: timetableIdParamsSchema, body: adjustTimetableSchema }),
    controller.adjust,
  )
  router.delete('/:id', requireTrustedOrigin, authenticate, validateId, controller.delete)

  return router
}

export default createTimetableRouter()
