import { z } from 'zod'

export const gameCategories = [
  'Brain Training',
  'Memory Games',
  'Logic and Puzzle Games',
  'Focus Games',
  'Strategy Games',
  'Chess',
  'Sudoku',
  'Casual Games',
  'Arcade Games',
  'Racing Games',
  'Entertainment Games',
  'Educational Games',
]

const gameIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'Game ID must be a MongoDB ObjectId.')
const gameKeySchema = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,120}$/i, 'Game key is invalid.')
const imageSchema = z.string().max(26000).refine((value) => (
  value === ''
  || /^https:\/\/[^\s]+$/i.test(value)
  || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
), 'Use an HTTPS image URL or upload a PNG, JPEG, or WebP image under 18 KB.')

export const gameIdParamsSchema = z.object({ gameId: gameIdSchema }).strict()
export const gameKeyParamsSchema = z.object({ gameKey: gameKeySchema }).strict()
export const gamesEmptyQuerySchema = z.object({}).strict()

export const gameBodySchema = z.object({
  name: z.string().trim().min(1, 'Enter a game name.').max(60),
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
