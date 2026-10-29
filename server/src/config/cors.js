import cors from 'cors'
import { env } from './env.js'
import { HttpError } from '../middleware/httpError.js'

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.FRONTEND_ORIGINS.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new HttpError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed to access the API.'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,
})
