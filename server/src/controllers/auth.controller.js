import { env } from '../config/env.js'
import { HttpError } from '../middleware/httpError.js'
import { loginUser, registerUser, revokeSession } from '../services/auth.service.js'
import { getPrismaClient } from '../config/database.js'

const cookieName = 'lifepilot_session'

function cookieOptions(expiresAt) {
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(env.NODE_ENV === 'production' ? ['Secure'] : []),
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`,
  ]
}

function setSessionCookie(response, session) {
  response.setHeader('Set-Cookie', [
    `${cookieName}=${encodeURIComponent(session.token)}`,
    ...cookieOptions(session.expiresAt),
  ].join('; '))
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', [`${cookieName}=`, ...cookieOptions(new Date(0))].join('; '))
}

export function createAuthController(prismaProvider = getPrismaClient) {
  return {
    signup: async (request, response) => {
      const session = await registerUser(request.validated.body, prismaProvider())
      setSessionCookie(response, session)
      response.status(201).json({ user: session.user, expiresAt: session.expiresAt.toISOString() })
    },
    login: async (request, response) => {
      const session = await loginUser(request.validated.body, prismaProvider())
      setSessionCookie(response, session)
      response.status(200).json({ user: session.user, expiresAt: session.expiresAt.toISOString() })
    },
    logout: async (request, response) => {
      await revokeSession(request.cookies?.[cookieName], prismaProvider())
      clearSessionCookie(response)
      response.status(204).end()
    },
    me: (request, response) => {
      if (!request.auth?.user) throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.')
      response.status(200).json({ user: request.auth.user })
    },
  }
}
