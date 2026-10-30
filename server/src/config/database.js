import { PrismaClient } from '@prisma/client'
import { env } from './env.js'
import { HttpError } from '../middleware/httpError.js'

let prisma

export function getPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new HttpError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'The backend database is not configured. Set DATABASE_URL in server/.env.',
    )
  }

  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: env.DATABASE_URL } },
    })
  }

  return prisma
}

export async function disconnectDatabase() {
  if (!prisma) return
  await prisma.$disconnect()
  prisma = undefined
}
