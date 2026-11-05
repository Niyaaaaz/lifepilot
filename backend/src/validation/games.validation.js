import { z } from 'zod'

export const gameCategories = [
  'Brain Training',
  'Memory Games',
  'Logic and Puzzle Games',
  'Focus and Concentration',
  'Chess and Strategy',
  'Sudoku',
  'Casual Games',
  'Arcade Games',
  'Racing Games',
  'Entertainment Games',
  'Educational Games',
  'Relaxation Games',
]

const gameIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'Game ID must be a MongoDB ObjectId.')
const gameKeySchema = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,120}$/i, 'Game key is invalid.')
function isSafeWebUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    return !(
      /^(.+\.)?google\.[a-z.]+$/i.test(url.hostname)
      && /^\/search(?:\/|$)/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

const websiteSchema = z.string().trim().min(1, 'Enter a game website URL.').max(2048).url()
  .refine(isSafeWebUrl, 'Use a safe HTTP or HTTPS game website URL, not a Google Search link.')
const imageSchema = z.string().trim().max(2048).refine((value) => (
  value === ''
  || (z.string().url().safeParse(value).success && isSafeWebUrl(value))
), 'Use a safe HTTP or HTTPS image URL.')

export const gameIdParamsSchema = z.object({ gameId: gameIdSchema }).strict()
export const gameKeyParamsSchema = z.object({ gameKey: gameKeySchema }).strict()
export const gamesEmptyQuerySchema = z.object({}).strict()

export const gameBodySchema = z.object({
  name: z.string().trim().min(1, 'Enter a game name.').max(60),
  gameUrl: websiteSchema,
  description: z.string().trim().max(180).default(''),
  category: z.enum(gameCategories),
  thumbnailUrl: imageSchema.default(''),
  icon: z.string().max(16).default('🎮'),
}).strict()

export const gamePreferenceBodySchema = z.object({
  isFavorite: z.boolean().optional(),
  played: z.boolean().optional(),
}).strict().refine((value) => value.isFavorite !== undefined || value.played === true, {
  message: 'Provide a favorite state or mark the game as played.',
})
