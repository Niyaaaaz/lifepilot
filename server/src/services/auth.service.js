import { createHash, randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/httpError.js'

const dayMs = 24 * 60 * 60 * 1000
const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}
const dummyPasswordHash = argon2.hash(randomBytes(32).toString('hex'), passwordHashOptions)

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function publicUser(user) {
  return { id: user.id, name: user.displayName, email: user.email }
}

async function createSession(user, prisma, rememberMe = false) {
  const token = randomBytes(32).toString('base64url')
  const ttlDays = rememberMe ? env.SESSION_REMEMBER_TTL_DAYS : env.SESSION_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * dayMs)
  await prisma.userSession.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
  })
  return { token, expiresAt, user: publicUser(user) }
}

export async function registerUser({ name, email, password }, prisma) {
  const passwordHash = await argon2.hash(password, passwordHashOptions)
  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { displayName: name, email, passwordHash },
      })
      return createSession(user, transaction)
    })
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new HttpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.')
    }
    throw error
  }
}

export async function loginUser({ email, password, rememberMe = false }, prisma) {
  const user = await prisma.user.findUnique({ where: { email } })
  const hashToVerify = user?.passwordHash || await dummyPasswordHash
  if (!(await argon2.verify(hashToVerify, password)) || !user?.passwordHash) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }
  return createSession(user, prisma, rememberMe)
}

export async function findValidSession(token, prisma) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null

  const tokenHash = hashToken(token)
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  })

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    if (session && !session.revokedAt) {
      await prisma.userSession.deleteMany({ where: { id: session.id, expiresAt: { lte: new Date() } } })
    }
    return null
  }

  return {
    ...session,
    user: publicUser(session.user),
  }
}

export async function revokeSession(token, prisma) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return
  await prisma.userSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
