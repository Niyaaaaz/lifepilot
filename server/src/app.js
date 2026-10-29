import express from 'express'
import { corsMiddleware } from './config/cors.js'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import healthRouter from './routes/health.routes.js'

const app = express()

app.disable('x-powered-by')
app.use(corsMiddleware)
app.use(express.json({ limit: env.JSON_BODY_LIMIT }))
app.use('/api/health', healthRouter)
app.use('/api', notFound)
app.use(errorHandler)

export default app
