import { Router } from 'express'
import { getPrismaClient } from '../config/database.js'
import { createAccountController } from '../controllers/account.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import {
  accountEmptyQuerySchema,
  dashboardEmptyQuerySchema,
  preferencesBodySchema,
  userProfileBodySchema,
} from '../validation/account.validation.js'

export function createUserRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createAccountController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)

  router.get('/me', authenticate, validateRequest({ query: accountEmptyQuerySchema }), controller.getUser)
  router.patch(
    '/me',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ query: accountEmptyQuerySchema, body: userProfileBodySchema }),
    controller.updateUser,
  )
  return router
}

export function createPreferencesRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createAccountController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)

  router.get('/', authenticate, validateRequest({ query: accountEmptyQuerySchema }), controller.getPreferences)
  router.patch(
    '/',
    requireTrustedOrigin,
    authenticate,
    validateRequest({ query: accountEmptyQuerySchema, body: preferencesBodySchema }),
    controller.updatePreferences,
  )
  return router
}

export function createDashboardRouter({ prismaProvider = getPrismaClient, requireAuth } = {}) {
  const router = Router()
  const controller = createAccountController(prismaProvider)
  const authenticate = requireAuth || createRequireAuth(prismaProvider)

  router.get('/', authenticate, validateRequest({ query: dashboardEmptyQuerySchema }), controller.getDashboard)
  return router
}
