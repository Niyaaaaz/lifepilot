import { getPrismaClient } from '../config/database.js'
import {
  adjustTimetable,
  deleteTimetable,
  generateTimetable,
  getTimetable,
  listTimetables,
  updateTimetable,
} from '../services/timetable.service.js'

export function createTimetableController(prismaProvider = getPrismaClient, { aiGenerator, aiAdjuster } = {}) {
  return {
    generate: async (request, response) => {
      const result = await generateTimetable(request.validated.body, request.auth.userId, {
        prisma: prismaProvider(),
        aiGenerator,
      })
      response.status(result.timetable ? 201 : 200).json(result)
    },
    list: async (request, response) => {
      const timetables = await listTimetables(request.auth.userId, request.validated.query, prismaProvider())
      response.status(200).json({ timetables })
    },
    get: async (request, response) => {
      const timetable = await getTimetable(request.validated.params.id, request.auth.userId, prismaProvider())
      response.status(200).json({ timetable })
    },
    update: async (request, response) => {
      const timetable = await updateTimetable(
        request.validated.params.id,
        request.auth.userId,
        request.validated.body.activities,
        prismaProvider(),
      )
      response.status(200).json({ timetable })
    },
    adjust: async (request, response) => {
      const result = await adjustTimetable(
        request.validated.params.id,
        request.auth.userId,
        request.validated.body.instruction,
        { prisma: prismaProvider(), aiAdjuster },
      )
      response.status(200).json(result)
    },
    delete: async (request, response) => {
      await deleteTimetable(request.validated.params.id, request.auth.userId, prismaProvider())
      response.status(204).end()
    },
  }
}
