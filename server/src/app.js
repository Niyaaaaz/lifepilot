import express from 'express'
import { corsMiddleware } from './config/cors.js'
import { env } from './config/env.js'
import { parseCookies } from './middleware/cookies.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createDailyTasksRouter } from './routes/dailyTasks.routes.js'
import databaseHealthRouter from './routes/databaseHealth.routes.js'
import { createGoalsRouter } from './routes/goals.routes.js'
import healthRouter from './routes/health.routes.js'

export function createApp(options = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.use(corsMiddleware)
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false)
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }))
  app.use(parseCookies)
  app.use('/api/health', healthRouter)
  app.use('/api/health/database', databaseHealthRouter)
  app.use('/api/auth', createAuthRouter(options))
  app.use('/api/daily/tasks', createDailyTasksRouter(options))
  app.use('/api/goals', createGoalsRouter(options))
  app.use('/api', notFound)
  app.use(errorHandler)

  return app
}

const app = createApp()

export default app
