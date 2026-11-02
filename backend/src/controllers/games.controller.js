import { getPrismaClient } from '../config/database.js'
import {
  createGame,
  deleteGame,
  listGames,
  updateGame,
  updateGamePreference,
} from '../services/games.service.js'

export function createGamesController(prismaProvider = getPrismaClient) {
  return {
    list: async (request, response) => {
      response.status(200).json(await listGames(request.auth.userId, prismaProvider()))
    },
    create: async (request, response) => {
      const game = await createGame(request.validated.body, request.auth.userId, prismaProvider())
      response.status(201).json({ game })
    },
    update: async (request, response) => {
      const game = await updateGame(
        request.validated.params.gameId,
        request.validated.body,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ game })
    },
    delete: async (request, response) => {
      await deleteGame(request.validated.params.gameId, request.auth.userId, prismaProvider())
      response.status(204).end()
    },
    preference: async (request, response) => {
      const preference = await updateGamePreference(
        request.validated.params.gameKey,
        request.validated.body,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ preference })
    },
  }
}
