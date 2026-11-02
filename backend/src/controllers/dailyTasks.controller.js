import { getPrismaClient } from '../config/database.js'
import {
  completeTaskRetake,
  createPersonalTask,
  deletePersonalTask,
  listDailyTasks,
  startTaskRetake,
  updateDailyTask,
} from '../services/dailyTasks.service.js'

export function createDailyTasksController(prismaProvider = getPrismaClient) {
  return {
    list: async (request, response) => {
      const { from, to } = request.validated.query
      const tasks = await listDailyTasks(request.auth.userId, from, to, prismaProvider())
      response.status(200).json({ tasks })
    },
    create: async (request, response) => {
      const task = await createPersonalTask(request.validated.body, request.auth.userId, prismaProvider())
      response.status(201).json({ task })
    },
    update: async (request, response) => {
      const task = await updateDailyTask(
        request.validated.params.taskId,
        request.validated.body,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ task })
    },
    startRetake: async (request, response) => {
      const task = await startTaskRetake(request.validated.params.taskId, request.auth.userId, prismaProvider())
      response.status(200).json({ task })
    },
    completeRetake: async (request, response) => {
      const task = await completeTaskRetake(
        request.validated.params.taskId,
        request.validated.body.notes,
        request.auth.userId,
        prismaProvider(),
      )
      response.status(200).json({ task })
    },
    delete: async (request, response) => {
      await deletePersonalTask(request.validated.params.taskId, request.auth.userId, prismaProvider())
      response.status(204).end()
    },
  }
}
