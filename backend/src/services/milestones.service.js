import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

function milestoneResponse(milestone) {
  const completed = Boolean(milestone.completedAt) || milestone.status === 'COMPLETED'
  return {
    id: milestone.id,
    goalId: milestone.goalId,
    title: milestone.title,
    description: milestone.description,
    dueDate: milestone.targetDate?.toISOString().slice(0, 10) || null,
    status: completed ? 'completed' : 'pending',
    completedAt: milestone.completedAt?.toISOString() || null,
    createdAt: milestone.createdAt,
    updatedAt: milestone.updatedAt,
  }
}

async function findOwnedGoal(goalId, userId, prisma) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } })
  if (!goal) throw new HttpError(404, 'GOAL_NOT_FOUND', 'The requested goal was not found.')
}

export async function listMilestones(goalId, userId, prisma = getPrismaClient()) {
  await findOwnedGoal(goalId, userId, prisma)
  const milestones = await prisma.goalMilestone.findMany({
    where: { goalId, userId },
    orderBy: { sortOrder: 'asc' },
  })
  return milestones.map(milestoneResponse)
}

export async function createMilestone(goalId, userId, input, prisma = getPrismaClient()) {
  await findOwnedGoal(goalId, userId, prisma)
  const last = await prisma.goalMilestone.findFirst({
    where: { goalId, userId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const completed = input.status === 'completed'
  const milestone = await prisma.goalMilestone.create({
    data: {
      userId,
      goalId,
      title: input.title,
      description: input.description || '',
      targetDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
      status: completed ? 'COMPLETED' : 'PENDING',
      completedAt: completed ? new Date() : null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })
  return milestoneResponse(milestone)
}

export async function updateMilestone(milestoneId, userId, input, prisma = getPrismaClient()) {
  const existing = await prisma.goalMilestone.findFirst({ where: { id: milestoneId, userId } })
  if (!existing) throw new HttpError(404, 'MILESTONE_NOT_FOUND', 'The requested milestone was not found.')
  const data = {}
  if (input.title !== undefined) data.title = input.title
  if (input.description !== undefined) data.description = input.description
  if (input.dueDate !== undefined) {
    data.targetDate = input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null
  }
  if (input.status !== undefined) {
    data.status = input.status === 'completed' ? 'COMPLETED' : 'PENDING'
    data.completedAt = input.status === 'completed' ? existing.completedAt || new Date() : null
  }
  const milestone = await prisma.goalMilestone.update({ where: { id: milestoneId }, data })
  return milestoneResponse(milestone)
}

export async function deleteMilestone(milestoneId, userId, prisma = getPrismaClient()) {
  const result = await prisma.goalMilestone.deleteMany({ where: { id: milestoneId, userId } })
  if (!result.count) throw new HttpError(404, 'MILESTONE_NOT_FOUND', 'The requested milestone was not found.')
}
