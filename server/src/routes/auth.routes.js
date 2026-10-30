import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getPrismaClient } from '../config/database.js'
import { createAuthController } from '../controllers/auth.controller.js'
import { createRequireAuth } from '../middleware/requireAuth.js'
import { requireTrustedOrigin } from '../middleware/requireTrustedOrigin.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { authEmptyQuerySchema, loginBodySchema, signupBodySchema } from '../validation/auth.validation.js'

export function createAuthRouter({ prismaProvider = getPrismaClient, limiterEnabled = true } = {}) {
  const router = Router()
  const controller = createAuthController(prismaProvider)
  const requireAuth = createRequireAuth(prismaProvider)
  const loginLimiter = limiterEnabled
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in attempts. Try again later.' } },
    })
    : (_request, _response, next) => next()

  router.post('/signup', requireTrustedOrigin, loginLimiter, validateRequest({ body: signupBodySchema }), controller.signup)
  router.post('/login', requireTrustedOrigin, loginLimiter, validateRequest({ body: loginBodySchema }), controller.login)
  router.post('/logout', requireTrustedOrigin, controller.logout)
  router.get('/me', validateRequest({ query: authEmptyQuerySchema }), requireAuth, controller.me)

  return router
}

export default createAuthRouter()
