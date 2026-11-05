import { getPrismaClient } from '../config/database.js'
import {
  getDashboard,
  getUserPreferences,
  getUserProfile,
  updateUserPreferences,
  updateUserProfile,
} from '../services/account.service.js'

export function createAccountController(prismaProvider = getPrismaClient) {
  return {
    getUser: async (request, response) => {
      response.status(200).json(await getUserProfile(request.auth.userId, prismaProvider()))
    },
    updateUser: async (request, response) => {
      response.status(200).json(await updateUserProfile(
        request.auth.userId,
        request.validated.body,
        prismaProvider(),
      ))
    },
    getPreferences: async (request, response) => {
      const preferences = await getUserPreferences(request.auth.userId, prismaProvider())
      response.status(200).json({ preferences })
    },
    updatePreferences: async (request, response) => {
      const preferences = await updateUserPreferences(
        request.auth.userId,
        request.validated.body,
        prismaProvider(),
      )
      response.status(200).json({ preferences })
    },
    getDashboard: async (request, response) => {
      const dashboard = await getDashboard(request.auth.userId, prismaProvider())
      response.status(200).json({ dashboard })
    },
  }
}
