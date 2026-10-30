import { getPrismaClient } from '../config/database.js'
import { createGoal, deleteGoal, getGoal, listGoals, updateGoal } from '../services/goals.service.js'

export function createGoalsController(prismaProvider = getPrismaClient) {
  return {
    list: async (request, response) => {
      const goals = await listGoals(request.auth.userId, prismaProvider())
      response.status(200).json({ goals })
    },
    get: async (request, response) => {
      const goal = await getGoal(request.validated.params.goalId, request.auth.userId, prismaProvider())
      response.status(200).json({ goal })
    },
    create: async (request, response) => {
      const goal = await createGoal(request.validated.body, request.auth.userId, prismaProvider())
      response.status(201).json({ goal })
    },
    update: async (request, response) => {
      const goal = await updateGoal(
        request.validated.params.goalId,
        request.validated.body,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ goal })
    },
    delete: async (request, response) => {
      await deleteGoal(request.validated.params.goalId, request.auth.userId, prismaProvider())
      response.status(204).end()
    },
  }
}
