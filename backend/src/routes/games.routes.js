import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createGamesController } from '../controllers/games.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  gameBodySchema,
  gameIdParamsSchema,
  gameKeyParamsSchema,
  gamePreferenceBodySchema,
  gamesEmptyQuerySchema,
} from '../validation/games.validation.js'

export function createGamesRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createGamesController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)

  router.get('/', authenticate, validateRequest({ query: gamesEmptyQuerySchema }), controller.list)
  router.post(
    '/',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ query: gamesEmptyQuerySchema, body: gameBodySchema }),
    controller.create,
  )
  router.patch(
    '/preferences/:gameKey',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: gameKeyParamsSchema, query: gamesEmptyQuerySchema, body: gamePreferenceBodySchema }),
    controller.preference,
  )
  router.patch(
    '/:gameId',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: gameIdParamsSchema, query: gamesEmptyQuerySchema, body: gameBodySchema }),
    controller.update,
  )
  router.delete(
    '/:gameId',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ params: gameIdParamsSchema, query: gamesEmptyQuerySchema }),
    controller.delete,
  )
  return router
}

export default createGamesRouter()
