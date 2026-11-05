import { getPrismaClient } from '../config/database.js'
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  updateMilestone,
} from '../services/milestones.service.js'

export function createMilestonesController(prismaProvider = getPrismaClient) {
  return {
    list: async (request, response) => {
      const milestones = await listMilestones(
        request.validated.params.goalId,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ milestones })
    },
    create: async (request, response) => {
      const milestone = await createMilestone(
        request.validated.params.goalId,
        request.auth.userId,
        request.validated.body,
        prismaProvider(),
      )
      response.status(201).json({ milestone })
    },
    update: async (request, response) => {
      const milestone = await updateMilestone(
        request.validated.params.milestoneId,
        request.auth.userId,
        request.validated.body,
        prismaProvider(),
      )
      response.status(200).json({ milestone })
    },
    delete: async (request, response) => {
      await deleteMilestone(request.validated.params.milestoneId, request.auth.userId, prismaProvider())
      response.status(204).end()
    },
  }
}
