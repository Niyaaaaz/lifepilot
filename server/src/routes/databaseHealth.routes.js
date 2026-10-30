import { Router } from 'express'
import { databaseHealthController } from '../controllers/databaseHealth.controller.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { healthQuerySchema } from '../validation/health.validation.js'

const databaseHealthRouter = Router()

databaseHealthRouter.get('/', validateRequest({ query: healthQuerySchema }), databaseHealthController)

export default databaseHealthRouter
