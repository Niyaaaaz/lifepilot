import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import argon2 from 'argon2'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

const allowedOrigin = 'http://127.0.0.1:4173'
const password = 'MyTestPassphrase2026'
let server
let baseUrl
let database
let users
let sessions

function createMemoryDatabase() {
  users = new Map()
  sessions = new Map()

  return {
    async $transaction(callback) {
      return callback(this)
    },
    user: {
      async create({ data }) {
        if (users.has(data.email)) {
          const error = new Error('Unique constraint')
          error.code = 'P2002'
          throw error
        }
        const user = { id: randomUUID(), ...data, createdAt: new Date() }
        users.set(user.email, user)
        return user
      },
      async findUnique({ where }) {
        return users.get(where.email) || null
      },
      async updateMany({ where, data }) {
        const user = [...users.values()].find((item) => item.id === where.id && item.passwordHash === where.passwordHash)
        if (!user) return { count: 0 }
        Object.assign(user, data)
        return { count: 1 }
      },
    },
    userSession: {
      async create({ data }) {
        const session = { id: randomUUID(), revokedAt: null, ...data }
        sessions.set(session.tokenHash, session)
        return session
      },
      async findUnique({ where }) {
        const session = sessions.get(where.tokenHash)
        if (!session) return null
        const user = [...users.values()].find((item) => item.id === session.userId)
        return { ...session, user: { id: user.id, displayName: user.displayName, email: user.email } }
      },
      async updateMany({ where, data }) {
        const session = sessions.get(where.tokenHash)
        if (!session || (where.revokedAt === null && session.revokedAt !== null)) return { count: 0 }
        Object.assign(session, data)
        return { count: 1 }
      },
      async deleteMany({ where }) {
        const session = [...sessions.values()].find((item) => item.id === where.id && item.expiresAt <= where.expiresAt.lte)
        if (!session) return { count: 0 }
        sessions.delete(session.tokenHash)
        return { count: 1 }
      },
    },
  }
}

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: allowedOrigin,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

function cookieFrom(response) {
  return response.headers.get('set-cookie').split(';', 1)[0]
}

before(async () => {
  database = createMemoryDatabase()
  server = createApp({ prismaProvider: () => database, limiterEnabled: false }).listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('signup validates input, hashes passwords, creates a session, and returns an anonymous profile without a session', async () => {
  const response = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email: 'Test.User@example.com', password }),
  })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.user.email, 'test.user@example.com')
  assert.equal('passwordHash' in body.user, false)
  assert.equal(users.get(body.user.email).passwordHash === password, false)
  assert.match(users.get(body.user.email).passwordHash, /^\$2[aby]\$/)
  const defaultSession = [...sessions.values()][0]
  const defaultLifetimeDays = (defaultSession.expiresAt.getTime() - Date.now()) / 86400000
  assert.ok(defaultLifetimeDays > 6.9 && defaultLifetimeDays <= 7)
  const defaultCookieMaxAge = Number(response.headers.get('set-cookie').match(/Max-Age=(\d+)/)[1])
  assert.ok(defaultCookieMaxAge > 6 * 86400 && defaultCookieMaxAge <= 7 * 86400)

  const cookie = cookieFrom(response)
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/)
  const anonymousProfile = await request('/api/auth/me')
  assert.equal(anonymousProfile.status, 200)
  assert.deepEqual(await anonymousProfile.json(), { user: null })
  const anonymousTasks = await request('/api/daily/tasks?from=2026-10-30&to=2026-10-30')
  assert.equal(anonymousTasks.status, 401)

  const profileResponse = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(profileResponse.status, 200)
  assert.deepEqual((await profileResponse.json()).user, body.user)

  const duplicate = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', email: 'TEST.USER@example.com', password }),
  })
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json()).error.code, 'EMAIL_ALREADY_REGISTERED')
})

test('login rejects invalid credentials and establishes a persistent cookie session', async () => {
  const invalid = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test.user@example.com', password: 'wrong-password-99' }),
  })
  assert.equal(invalid.status, 401)
  assert.equal((await invalid.json()).error.code, 'INVALID_CREDENTIALS')

  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'TEST.USER@example.com', password, rememberMe: true }),
  })
  assert.equal(response.status, 200)
  const cookie = cookieFrom(response)
  assert.equal((await request('/api/auth/me', { headers: { Cookie: cookie } })).status, 200)
  const rememberedSession = [...sessions.values()].at(-1)
  const rememberedLifetimeDays = (rememberedSession.expiresAt.getTime() - Date.now()) / 86400000
  assert.ok(rememberedLifetimeDays > 29.9 && rememberedLifetimeDays <= 30)
  const rememberedCookieMaxAge = Number(response.headers.get('set-cookie').match(/Max-Age=(\d+)/)[1])
  assert.ok(rememberedCookieMaxAge > 29 * 86400 && rememberedCookieMaxAge <= 30 * 86400)
})

test('logout revokes the session and expires the browser cookie', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test.user@example.com', password }),
  })
  const cookie = cookieFrom(login)
  const token = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))
  const tokenHash = createHash('sha256').update(token).digest('hex')
  delete sessions.get(tokenHash).revokedAt
  const response = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })

  assert.equal(response.status, 204)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  const protectedResponse = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(protectedResponse.status, 200)
  assert.deepEqual(await protectedResponse.json(), { user: null })
})

test('expired sessions and untrusted origins cannot access protected operations', async () => {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const user = users.get('test.user@example.com')
  sessions.set(tokenHash, {
    id: randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() - 1000),
    revokedAt: null,
  })

  const expired = await request('/api/auth/me', {
    headers: { Cookie: `lifepilot_session=${token}` },
  })
  assert.equal(expired.status, 200)
  assert.deepEqual(await expired.json(), { user: null })
  assert.match(expired.headers.get('set-cookie'), /Max-Age=0/)
  const expiredTasks = await request('/api/daily/tasks?from=2026-10-30&to=2026-10-30', {
    headers: { Cookie: `lifepilot_session=${token}` },
  })
  assert.equal(expiredTasks.status, 401)
  assert.equal((await expiredTasks.json()).error.code, 'SESSION_EXPIRED')

  const invalidOrigin = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
  assert.equal(invalidOrigin.status, 403)
  assert.equal((await invalidOrigin.json()).error.code, 'UNTRUSTED_ORIGIN')
})

test('signup returns field-level validation errors', async () => {
  const response = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'A', email: 'bad', password: 'short' }),
  })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
  assert.ok(body.error.details.some((issue) => issue.path === 'password'))
})

test('existing Argon2 accounts can sign in and are upgraded to bcrypt hashes', async () => {
  const legacyPassword = 'LegacyPassphrase2026'
  const legacyUser = {
    id: randomUUID(),
    displayName: 'Legacy User',
    email: 'legacy.user@example.com',
    passwordHash: await argon2.hash(legacyPassword),
    isActive: true,
    createdAt: new Date(),
  }
  users.set(legacyUser.email, legacyUser)

  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: legacyUser.email, password: legacyPassword }),
  })

  assert.equal(response.status, 200)
  assert.match(legacyUser.passwordHash, /^\$2[aby]\$/)
  assert.equal('passwordHash' in (await response.json()).user, false)
})
