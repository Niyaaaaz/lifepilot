import { env } from '../config/env.js'
import { HttpError } from './httpError.js'

export function requireTrustedOrigin(request, _response, next) {
  const origin = request.get('origin')
  if (!origin || !env.FRONTEND_ORIGINS.includes(origin)) {
    next(new HttpError(403, 'UNTRUSTED_ORIGIN', 'This request origin is not allowed.'))
    return
  }
  next()
}
