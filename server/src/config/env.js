import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const envFile = fileURLToPath(new URL('../../.env', import.meta.url))
config({ path: envFile })

const defaultFrontendOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
].join(',')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGINS: z.string().default(defaultFrontendOrigins),
  JSON_BODY_LIMIT: z.string().regex(/^\d+(?:b|kb|mb)?$/i).default('32kb'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid backend environment configuration: ${details}`)
}

const frontendOrigins = result.data.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)

if (frontendOrigins.length === 0) {
  throw new Error('Invalid backend environment configuration: FRONTEND_ORIGINS must contain at least one origin.')
}

for (const origin of frontendOrigins) {
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error(`Invalid frontend origin in FRONTEND_ORIGINS: ${origin}`)
  }
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`FRONTEND_ORIGINS entries must be exact http(s) origins without paths: ${origin}`)
  }
}

export const env = {
  ...result.data,
  FRONTEND_ORIGINS: [...new Set(frontendOrigins)],
}
