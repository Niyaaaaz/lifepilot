import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

const legacyCategories = {
  'Focus Games': 'Focus and Concentration',
  'Strategy Games': 'Chess and Strategy',
  Chess: 'Chess and Strategy',
}

function playableGameUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    if (
      /^(.+\.)?google\.[a-z.]+$/i.test(url.hostname)
      && /^\/search(?:\/|$)/i.test(url.pathname)
    ) return ''
    return url.href
  } catch {
    return ''
  }
}

function gameResponse(game) {
  return {
    id: game.id,
    name: game.name,
    description: game.description,
    category: legacyCategories[game.category] || game.category,
    gameUrl: playableGameUrl(game.gameUrl),
    thumbnailUrl: game.thumbnailUrl || '',
    icon: game.icon || '🎮',
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  }
}

export async function listGames(userId, prisma = getPrismaClient()) {
  const [games, preferences] = await Promise.all([
    prisma.brainTrainingGame.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.userGamePreference.findMany({ where: { userId } }),
  ])
  return {
    games: games.map(gameResponse),
    preferences: preferences.map((preference) => ({
      gameKey: preference.gameKey,
      isFavorite: preference.isFavorite,
      lastPlayedAt: preference.lastPlayedAt?.toISOString() || null,
    })),
  }
}

export async function createGame(input, userId, prisma = getPrismaClient()) {
  try {
    const game = await prisma.brainTrainingGame.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        category: input.category,
        gameUrl: input.gameUrl,
        thumbnailUrl: input.thumbnailUrl || null,
        icon: input.icon || null,
      },
    })
    return gameResponse(game)
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new HttpError(409, 'GAME_ALREADY_EXISTS', 'You have already added this game.')
    }
    throw error
  }
}

export async function updateGame(gameId, input, userId, prisma = getPrismaClient()) {
  const existing = await prisma.brainTrainingGame.findFirst({ where: { id: gameId, userId } })
  if (!existing) throw new HttpError(404, 'GAME_NOT_FOUND', 'The requested game was not found.')
  try {
    const game = await prisma.brainTrainingGame.update({
      where: { id: gameId },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        gameUrl: input.gameUrl,
        thumbnailUrl: input.thumbnailUrl || null,
        icon: input.icon || null,
      },
    })
    return gameResponse(game)
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new HttpError(409, 'GAME_ALREADY_EXISTS', 'You have already added this game.')
    }
    throw error
  }
}

export async function deleteGame(gameId, userId, prisma = getPrismaClient()) {
  const result = await prisma.brainTrainingGame.deleteMany({ where: { id: gameId, userId } })
  if (result.count === 0) throw new HttpError(404, 'GAME_NOT_FOUND', 'The requested game was not found.')
  await prisma.userGamePreference.deleteMany({ where: { userId, gameKey: `custom-${gameId}` } })
}

export async function updateGamePreference(gameKey, input, userId, prisma = getPrismaClient()) {
  if (gameKey.startsWith('custom-')) {
    const gameId = gameKey.slice('custom-'.length)
    const game = await prisma.brainTrainingGame.findFirst({ where: { id: gameId, userId } })
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'The requested game was not found.')
  }

  const previous = await prisma.userGamePreference.findUnique({
    where: { userId_gameKey: { userId, gameKey } },
  })
  const data = {
    ...(input.isFavorite === undefined ? {} : { isFavorite: input.isFavorite }),
    ...(input.played ? { lastPlayedAt: new Date() } : {}),
  }
  const preference = previous
    ? await prisma.userGamePreference.update({ where: { id: previous.id }, data })
    : await prisma.userGamePreference.create({
      data: { userId, gameKey, isFavorite: input.isFavorite ?? false, ...(input.played ? { lastPlayedAt: new Date() } : {}) },
    })
  return {
    gameKey: preference.gameKey,
    isFavorite: preference.isFavorite,
    lastPlayedAt: preference.lastPlayedAt?.toISOString() || null,
  }
}
