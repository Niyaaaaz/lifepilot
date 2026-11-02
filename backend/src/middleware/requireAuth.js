import { findValidSession } from '../services/auth.service.js'
import { HttpError } from './httpError.js'

export function createRequireAuth(prismaProvider) {
  return async function requireAuth(request, _response, next) {
    try {
      const token = request.cookies?.lifepilot_session
      if (!token) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.')

      const session = await findValidSession(token, prismaProvider())
      if (!session) throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.')

      request.auth = { userId: session.userId, sessionId: session.id, user: session.user }
      next()
    } catch (error) {
      next(error)
    }
  }
}
