import { Router } from 'express'
import { healthController } from '../controllers/health.controller.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { healthQuerySchema } from '../validation/health.validation.js'

const healthRouter = Router()

healthRouter.get('/', validateRequest({ query: healthQuerySchema }), healthController)

export default healthRouter
