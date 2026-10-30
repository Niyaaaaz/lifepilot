import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

const durationUnits = {
  days: 'DAYS',
  weeks: 'WEEKS',
  months: 'MONTHS',
  years: 'YEARS',
}
const durationUnitNames = Object.fromEntries(Object.entries(durationUnits).map(([name, value]) => [value, name]))
const goalStatuses = {
  active: 'ACTIVE',
  paused: 'PAUSED',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
}
const taskStatuses = {
  'Not Started': 'NOT_STARTED',
  'In Progress': 'IN_PROGRESS',
  Completed: 'COMPLETED',
}
const taskStatusNames = Object.fromEntries(Object.entries(taskStatuses).map(([name, value]) => [value, name]))
const taskPriorities = { High: 'HIGH', Normal: 'NORMAL', Low: 'LOW' }
const taskPriorityNames = Object.fromEntries(Object.entries(taskPriorities).map(([name, value]) => [value, name]))

function dateOnly(value) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function dateString(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function uuidLike(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function goalData(input, userId) {
  const {
    title, description, durationAmount, durationUnit, startDate, targetDate, status, category,
    current, hoursPerDay, preferredDays, availableStartTime, availableEndTime, _phases, _milestones,
    ...roadmapData
  } = input
  return {
    userId,
    title,
    description,
    durationAmount,
    durationUnit: durationUnits[durationUnit],
    startsAt: dateOnly(startDate),
    targetDate: dateOnly(targetDate),
    status: goalStatuses[status],
    category: category || null,
    currentLevel: current.slice(0, 120) || null,
    availableMinutes: Math.round(hoursPerDay * 60),
    preferredDays,
    availableStartTime: availableStartTime || null,
    availableEndTime: availableEndTime || null,
    roadmapData,
  }
}

function progressFor(tasks) {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.status === 'COMPLETED').length
  return {
    totalTasks,
    completedTasks,
    percentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
  }
}

async function loadGoal(goalId, userId, prisma) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } })
  if (!goal) return null

  const [monthlyObjectives, weeklyObjectives, milestones, tasks] = await Promise.all([
    prisma.monthlyObjective.findMany({
      where: { goalId, userId },
      orderBy: { monthNumber: 'asc' },
    }),
    prisma.weeklyObjective.findMany({
      where: { goalId, userId },
      orderBy: { weekNumber: 'asc' },
    }),
    prisma.goalMilestone.findMany({
      where: { goalId, userId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.dailyTask.findMany({
      where: { goalId, userId },
      include: {
        completions: { orderBy: { completedAt: 'asc' } },
        schedules: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const progress = progressFor(tasks)
  const monthlyById = new Map(monthlyObjectives.map((month) => [month.id, month]))

  return {
    id: goal.id,
    legacyId: goal.legacyId || '',
    title: goal.title,
    description: goal.description,
    outcome: goal.roadmapData.outcome || goal.description,
    current: goal.roadmapData.current || goal.currentLevel || '',
    category: goal.category || '',
    startDate: dateString(goal.startsAt),
    targetDate: dateString(goal.targetDate),
    durationAmount: goal.durationAmount,
    durationUnit: durationUnitNames[goal.durationUnit] || 'days',
    durationDays: goal.roadmapData.durationDays || 0,
    hoursPerDay: (goal.availableMinutes || 0) / 60,
    preferredDays: goal.preferredDays,
    availableStartTime: goal.availableStartTime || '',
    availableEndTime: goal.availableEndTime || '',
    status: goal.status.toLowerCase(),
    createdAt: goal.createdAt.toISOString(),
    ...goal.roadmapData,
    progress: progress.percentage,
    totalTasks: progress.totalTasks,
    completedTasks: progress.completedTasks,
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      monthKey: milestone.sourceKey || `milestone-${milestone.sortOrder + 1}`,
      title: milestone.title,
      outcome: milestone.description,
      date: dateString(milestone.targetDate),
      completedAt: milestone.completedAt?.toISOString() || '',
    })),
    monthlyObjectives: monthlyObjectives.map((month) => ({
      id: month.id,
      monthNumber: month.monthNumber,
      title: month.title,
      description: month.description,
      startDate: dateString(month.startsOn),
      endDate: dateString(month.endsOn),
      successCriteria: month.successCriteria,
    })),
    phases: weeklyObjectives.map((phase) => {
      const month = monthlyById.get(phase.monthlyObjectiveId)
      const phaseTasks = tasks.filter((task) => task.weeklyObjectiveId === phase.id)
      return {
        id: phase.id,
        name: phase.title,
        objective: phase.description,
        completionCriteria: phase.successCriteria,
        weekNumber: phase.weekNumber,
        monthNumber: month?.monthNumber || Math.ceil(phase.weekNumber / 4),
        monthKey: `month-${month?.monthNumber || Math.ceil(phase.weekNumber / 4)}`,
        monthLabel: month?.title || `Month ${Math.ceil(phase.weekNumber / 4)}`,
        startDate: dateString(phase.startsOn),
        endDate: dateString(phase.endsOn),
        weeks: 1,
        tasks: phaseTasks.map((task) => {
          const schedule = task.schedules[0]
          return {
            id: task.id,
            scheduleKey: task.sourceKey || undefined,
            title: task.title,
            detail: task.description,
            priority: taskPriorityNames[task.priority] || 'Normal',
            minutes: task.estimatedMinutes,
            status: taskStatusNames[task.status] || 'Not Started',
            completed: task.status === 'COMPLETED',
            completedAt: task.completedAt?.toISOString() || '',
            notes: task.notes,
            scheduledDate: dateString(schedule?.scheduledDate),
            startTime: schedule?.startTime || '',
            endTime: schedule?.endTime || '',
            scheduleConflict: false,
            completionHistory: task.completions.map((completion) => ({
              completedAt: completion.completedAt.toISOString(),
              notes: completion.notes,
            })),
            completionCount: task.completions.length,
          }
        }),
      }
    }),
  }
}

function groupMonths(phases) {
  const groups = new Map()
  for (const phase of phases) {
    const monthNumber = phase.monthNumber
    const group = groups.get(monthNumber) || { phases: [], number: monthNumber }
    group.phases.push(phase)
    groups.set(monthNumber, group)
  }
  return [...groups.values()].sort((a, b) => a.number - b.number)
}

async function syncStructure(prisma, goalId, userId, input, existing = null) {
  const oldMilestones = existing
    ? await prisma.goalMilestone.findMany({ where: { goalId, userId } })
    : []
  for (const [index, milestone] of input.milestones.entries()) {
    const sourceKey = milestone.monthKey || `milestone-${index + 1}`
    const old = oldMilestones.find((item) => item.sourceKey === sourceKey || (uuidLike(milestone.id) && item.id === milestone.id))
    const data = {
      sourceKey,
      title: milestone.title,
      description: milestone.outcome,
      targetDate: dateOnly(milestone.date),
      sortOrder: index,
    }
    if (old) {
      await prisma.goalMilestone.update({ where: { id: old.id }, data })
    } else {
      await prisma.goalMilestone.create({ data: { ...data, goalId, userId } })
    }
  }
  for (const old of oldMilestones) {
    if (input.milestones.some((milestone, index) => (milestone.monthKey || `milestone-${index + 1}`) === old.sourceKey)) continue
    if (!old.completedAt) await prisma.goalMilestone.deleteMany({ where: { id: old.id, userId } })
  }

  const oldMonths = existing ? await prisma.monthlyObjective.findMany({ where: { goalId, userId } }) : []
  const monthRecords = new Map()
  for (const group of groupMonths(input.phases)) {
    const first = group.phases[0]
    const last = group.phases.at(-1)
    const data = {
      monthNumber: group.number,
      title: first.monthLabel || `Month ${group.number}`,
      description: [...new Set(group.phases.map((phase) => phase.objective).filter(Boolean))].join('\n'),
      startsOn: dateOnly(first.startDate),
      endsOn: dateOnly(last.endDate),
      successCriteria: last.completionCriteria || '',
      sortOrder: group.number - 1,
    }
    const old = oldMonths.find((month) => month.monthNumber === group.number)
    const month = old
      ? await prisma.monthlyObjective.update({ where: { id: old.id }, data })
      : await prisma.monthlyObjective.create({ data: { ...data, goalId, userId } })
    monthRecords.set(group.number, month)
  }

  const oldPhases = existing
    ? await prisma.weeklyObjective.findMany({ where: { goalId, userId } })
    : []
  const seenPhaseIds = new Set()
  const seenTaskIds = new Set()
  const storedTasks = existing
    ? await prisma.dailyTask.findMany({
      where: { goalId, userId },
      include: {
        completions: { orderBy: { completedAt: 'asc' } },
        schedules: { orderBy: { createdAt: 'desc' } },
      },
    })
    : []

  for (const [phaseIndex, phase] of input.phases.entries()) {
    const oldPhase = oldPhases.find((item) => item.weekNumber === phase.weekNumber)
    const phaseData = {
      title: phase.name,
      description: phase.objective,
      weekNumber: phase.weekNumber,
      startsOn: dateOnly(phase.startDate),
      endsOn: dateOnly(phase.endDate),
      successCriteria: phase.completionCriteria,
      sortOrder: phaseIndex,
      monthlyObjectiveId: monthRecords.get(phase.monthNumber)?.id || null,
    }
    const savedPhase = oldPhase
      ? await prisma.weeklyObjective.update({ where: { id: oldPhase.id }, data: phaseData })
      : await prisma.weeklyObjective.create({ data: { ...phaseData, goalId, userId } })
    seenPhaseIds.add(savedPhase.id)

    for (const [taskIndex, task] of phase.tasks.entries()) {
      const sourceKey = task.scheduleKey || task.sourceKey || `custom-${phase.weekNumber}-${task.id || taskIndex}`
      const oldTask = storedTasks.find((item) => (
        (uuidLike(task.id) && item.id === task.id)
        || (item.sourceKey === sourceKey && item.goalId === goalId)
      ))
      const status = taskStatuses[task.completed ? 'Completed' : task.status]
      const taskData = {
        userId,
        goalId,
        weeklyObjectiveId: savedPhase.id,
        sourceKey,
        title: task.title,
        description: task.detail,
        priority: taskPriorities[task.priority],
        estimatedMinutes: task.minutes,
        status,
        isGoalRepetition: task.isGoalRepetition,
        completedAt: status === 'COMPLETED'
          ? (task.completedAt ? new Date(task.completedAt) : oldTask?.completedAt || new Date())
          : null,
        notes: task.notes,
      }
      const savedTask = oldTask
        ? await prisma.dailyTask.update({ where: { id: oldTask.id }, data: taskData })
        : await prisma.dailyTask.create({ data: taskData })
      seenTaskIds.add(savedTask.id)

      const oldCompletions = oldTask?.completions || []
      const requestedHistory = task.completionHistory || []
      for (const completion of requestedHistory.slice(oldCompletions.length)) {
        await prisma.taskCompletion.create({
          data: {
            userId,
            taskId: savedTask.id,
            completedAt: completion.completedAt ? new Date(completion.completedAt) : new Date(),
            notes: completion.notes || '',
          },
        })
      }
      if (status === 'COMPLETED' && oldCompletions.length + requestedHistory.slice(oldCompletions.length).length === 0) {
        await prisma.taskCompletion.create({
          data: {
            userId,
            taskId: savedTask.id,
            completedAt: task.completedAt ? new Date(task.completedAt) : new Date(),
            notes: '',
          },
        })
      }

      const scheduledDate = dateOnly(task.scheduledDate)
      const startTime = task.startTime || null
      const endTime = task.endTime || null
      const oldSchedule = oldTask?.schedules?.[0]
      if (scheduledDate) {
        const sameSchedule = oldSchedule
          && dateString(oldSchedule.scheduledDate) === dateString(scheduledDate)
          && oldSchedule.startTime === startTime
          && oldSchedule.endTime === endTime
        if (sameSchedule) {
          await prisma.taskSchedule.update({
            where: { id: oldSchedule.id },
            data: { status: status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED' },
          })
        } else {
          if (oldSchedule && oldSchedule.status !== 'COMPLETED') {
            await prisma.taskSchedule.update({ where: { id: oldSchedule.id }, data: { status: 'RESCHEDULED' } })
          }
          await prisma.taskSchedule.create({
            data: {
              userId,
              taskId: savedTask.id,
              scheduledDate,
              startTime,
              endTime,
              status: status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
              supersedesId: oldSchedule?.id || null,
            },
          })
        }
      } else if (oldSchedule && oldSchedule.status === 'SCHEDULED') {
        await prisma.taskSchedule.update({ where: { id: oldSchedule.id }, data: { status: 'CANCELLED' } })
      }
    }
  }

  for (const oldTask of storedTasks) {
    if (seenTaskIds.has(oldTask.id)) continue
    if (oldTask.status === 'COMPLETED' || oldTask.completions.length) continue
    await prisma.dailyTask.deleteMany({ where: { id: oldTask.id, userId } })
  }
  for (const oldPhase of oldPhases) {
    if (seenPhaseIds.has(oldPhase.id)) continue
    const retainedTask = storedTasks.some((task) => task.weeklyObjectiveId === oldPhase.id && (
      task.status === 'COMPLETED' || task.completions.length > 0
    ))
    if (!retainedTask) await prisma.weeklyObjective.deleteMany({ where: { id: oldPhase.id, userId } })
  }
}

export async function listGoals(userId, prisma = getPrismaClient()) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return Promise.all(goals.map((goal) => loadGoal(goal.id, userId, prisma)))
}

export async function getGoal(goalId, userId, prisma = getPrismaClient()) {
  const goal = await loadGoal(goalId, userId, prisma)
  if (!goal) throw new HttpError(404, 'GOAL_NOT_FOUND', 'The requested goal was not found.')
  return goal
}

export async function createGoal(input, userId, prisma = getPrismaClient()) {
  if (input.legacyId) {
    const existing = await prisma.goal.findFirst({ where: { userId, legacyId: input.legacyId } })
    if (existing) return getGoal(existing.id, userId, prisma)
  }
  let id
  try {
    id = await prisma.$transaction(async (transaction) => {
      const goal = await transaction.goal.create({
        data: { ...goalData(input, userId), ...(input.legacyId ? { legacyId: input.legacyId } : {}) },
      })
      await syncStructure(transaction, goal.id, userId, input)
      return goal.id
    })
  } catch (error) {
    if (input.legacyId && error?.code === 'P2002') {
      const existing = await prisma.goal.findFirst({ where: { userId, legacyId: input.legacyId } })
      if (existing) return getGoal(existing.id, userId, prisma)
    }
    throw error
  }
  return getGoal(id, userId, prisma)
}

export async function updateGoal(goalId, input, userId, prisma = getPrismaClient()) {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.goal.findFirst({ where: { id: goalId, userId } })
    if (!existing) throw new HttpError(404, 'GOAL_NOT_FOUND', 'The requested goal was not found.')
    await transaction.goal.update({
      where: { id: goalId },
      data: goalData(input, userId),
    })
    await syncStructure(transaction, goalId, userId, input, existing)
  })
  return getGoal(goalId, userId, prisma)
}

export async function deleteGoal(goalId, userId, prisma = getPrismaClient()) {
  const result = await prisma.goal.deleteMany({ where: { id: goalId, userId } })
  if (result.count === 0) throw new HttpError(404, 'GOAL_NOT_FOUND', 'The requested goal was not found.')
}

export async function getGoalProgress(goalId, userId, prisma = getPrismaClient()) {
  const [totalTasks, completedTasks, repetitionCount] = await Promise.all([
    prisma.dailyTask.count({ where: { goalId, userId } }),
    prisma.dailyTask.count({ where: { goalId, userId, status: 'COMPLETED' } }),
    prisma.taskCompletion.count({
      where: { userId, task: { goalId, isGoalRepetition: true } },
    }),
  ])

  return {
    totalTasks,
    completedTasks,
    percentage: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    repetitionCount,
  }
}
