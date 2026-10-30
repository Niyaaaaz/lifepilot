import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

const taskStatus = { 'Not Started': 'NOT_STARTED', 'In Progress': 'IN_PROGRESS', Completed: 'COMPLETED' }
const taskStatusName = Object.fromEntries(Object.entries(taskStatus).map(([label, status]) => [status, label]))
const taskPriority = { High: 'HIGH', Normal: 'NORMAL', Low: 'LOW' }
const taskPriorityName = Object.fromEntries(Object.entries(taskPriority).map(([label, priority]) => [priority, label]))
const scheduleStatus = { 'Not Started': 'SCHEDULED', 'In Progress': 'SCHEDULED', Completed: 'COMPLETED' }

function dayDate(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

function dayString(value) {
  return value.toISOString().slice(0, 10)
}

function endTime(startTime, minutes) {
  const [hours, mins] = startTime.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  if (total >= 1440) {
    throw new HttpError(400, 'INVALID_TASK_TIME', 'The task must end before midnight.')
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function minutesAt(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

async function findOwnedTask(taskId, userId, prisma) {
  const task = await prisma.dailyTask.findFirst({
    where: { id: taskId, userId },
    include: {
      goal: true,
      weeklyObjective: true,
      schedules: {
        where: { supersededBy: null },
        orderBy: { createdAt: 'desc' },
      },
      completions: { orderBy: { completedAt: 'asc' } },
    },
  })
  if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'The requested task was not found.')
  return task
}

function taskResponse(task, schedule) {
  return {
    id: task.id,
    source: task.goalId ? 'goal' : 'personal',
    goalId: task.goalId || '',
    goalTitle: task.goal?.title || '',
    phaseId: task.weeklyObjectiveId || '',
    activity: task.title,
    description: task.description,
    category: task.goal?.category || task.category || 'Personal',
    priority: taskPriorityName[task.priority] || 'Normal',
    minutes: task.estimatedMinutes,
    date: schedule ? dayString(schedule.scheduledDate) : '',
    startTime: schedule?.startTime || '',
    endTime: schedule?.endTime || '',
    notes: task.notes,
    status: taskStatusName[task.status] || 'Not Started',
    retakeInProgress: task.retakeInProgress,
    completionHistory: task.completions.map((completion) => ({
      completedAt: completion.completedAt.toISOString(),
      notes: completion.notes,
    })),
    completionCount: task.completions.length,
    completedAt: task.completedAt?.toISOString() || '',
  }
}

async function ensureNoOverlap({ userId, taskId, date, startTime, minutes }, prisma) {
  const finish = endTime(startTime, minutes)
  const schedules = await prisma.taskSchedule.findMany({
    where: {
      userId,
      scheduledDate: dayDate(date),
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      supersededBy: null,
      ...(taskId ? { taskId: { not: taskId } } : {}),
    },
    include: { task: true },
  })
  const start = minutesAt(startTime)
  const end = minutesAt(finish)
  const conflict = schedules.find((schedule) => {
    if (!schedule.startTime) return false
    const otherStart = minutesAt(schedule.startTime)
    const otherEnd = schedule.endTime
      ? minutesAt(schedule.endTime)
      : otherStart + schedule.task.estimatedMinutes
    return start < otherEnd && end > otherStart
  })
  if (conflict) throw new HttpError(409, 'SCHEDULE_CONFLICT', 'That time overlaps another scheduled task.')
  return finish
}

async function ensureGoalAvailability(task, { userId, date, startTime, minutes }, prisma) {
  if (!task.goalId) return
  const goal = await prisma.goal.findFirst({ where: { id: task.goalId, userId } })
  if (!goal) throw new HttpError(404, 'GOAL_NOT_FOUND', 'The task’s linked goal was not found.')
  const weekday = dayDate(date).getUTCDay()
  const start = minutesAt(startTime)
  const finish = start + minutes
  if (goal.preferredDays.length && !goal.preferredDays.includes(weekday)) {
    throw new HttpError(400, 'GOAL_DAY_UNAVAILABLE', 'Schedule this task on one of the goal’s preferred days.')
  }
  if (goal.availableMinutes !== null && minutes > goal.availableMinutes) {
    throw new HttpError(400, 'GOAL_DURATION_EXCEEDED', 'The task duration exceeds this goal’s daily availability.')
  }
  if (goal.availableStartTime && start < minutesAt(goal.availableStartTime)) {
    throw new HttpError(400, 'GOAL_TIME_UNAVAILABLE', 'The task starts before this goal’s availability window.')
  }
  if (goal.availableEndTime && finish > minutesAt(goal.availableEndTime)) {
    throw new HttpError(400, 'GOAL_TIME_UNAVAILABLE', 'The task ends after this goal’s availability window.')
  }
}

async function saveSchedule(prisma, task, schedule, data, status) {
  const finish = endTime(data.startTime, data.minutes)
  const date = dayDate(data.date)
  if (
    schedule
    && dayString(schedule.scheduledDate) === data.date
    && schedule.startTime === data.startTime
    && schedule.endTime === finish
  ) {
    return prisma.taskSchedule.update({
      where: { id: schedule.id },
      data: { status: scheduleStatus[status] },
    })
  }

  if (schedule && schedule.status !== 'COMPLETED' && schedule.status !== 'CANCELLED') {
    await prisma.taskSchedule.update({
      where: { id: schedule.id },
      data: { status: 'RESCHEDULED' },
    })
  }
  return prisma.taskSchedule.create({
    data: {
      userId: task.userId,
      taskId: task.id,
      scheduledDate: date,
      startTime: data.startTime,
      endTime: finish,
      status: scheduleStatus[status],
      supersedesId: schedule?.id || null,
    },
  })
}

export async function listDailyTasks(userId, from, to, prisma = getPrismaClient()) {
  const schedules = await prisma.taskSchedule.findMany({
    where: {
      userId,
      scheduledDate: { gte: dayDate(from), lte: dayDate(to) },
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      supersededBy: null,
      task: { is: { OR: [{ goalId: null }, { goal: { is: { status: 'ACTIVE' } } }] } },
    },
    include: {
      task: {
        include: {
          goal: true,
          completions: { orderBy: { completedAt: 'asc' } },
        },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
  })
  return schedules.map((schedule) => taskResponse(schedule.task, schedule))
}

export async function createPersonalTask(input, userId, prisma = getPrismaClient()) {
  const saved = await prisma.$transaction(async (transaction) => {
    await ensureNoOverlap({ userId, ...input }, transaction)
    const task = await transaction.dailyTask.create({
      data: {
        userId,
        title: input.activity,
        description: input.description,
        category: input.category,
        priority: taskPriority[input.priority],
        estimatedMinutes: input.minutes,
        status: 'NOT_STARTED',
        notes: input.notes,
      },
    })
    const schedule = await saveSchedule(transaction, task, null, input, 'Not Started')
    return { task, schedule }
  })
  return taskResponse({ ...saved.task, completions: [], goal: null }, saved.schedule)
}

export async function updateDailyTask(taskId, input, userId, prisma = getPrismaClient()) {
  return prisma.$transaction(async (transaction) => {
    const task = await findOwnedTask(taskId, userId, transaction)
    const previousStatus = taskStatusName[task.status]
    if (previousStatus === 'Completed' && input.status && input.status !== 'Completed') {
      throw new HttpError(409, 'COMPLETED_TASK_STATUS_LOCKED', 'Completed tasks stay Completed; use Retake Task to record another attempt.')
    }

    const currentSchedule = task.schedules[0] || null
    const currentDate = currentSchedule ? dayString(currentSchedule.scheduledDate) : ''
    const next = {
      activity: input.activity ?? task.title,
      description: input.description ?? task.description,
      category: input.category ?? task.category,
      priority: input.priority ?? taskPriorityName[task.priority],
      date: input.date ?? currentDate,
      startTime: input.startTime ?? currentSchedule?.startTime ?? '',
      minutes: input.minutes ?? task.estimatedMinutes,
      notes: input.notes ?? task.notes,
    }
    if (!next.date || !next.startTime) {
      throw new HttpError(400, 'TASK_SCHEDULE_REQUIRED', 'A task requires a scheduled date and start time.')
    }

    const scheduleChanged = !currentSchedule
      || currentDate !== next.date
      || currentSchedule.startTime !== next.startTime
      || currentSchedule.endTime !== endTime(next.startTime, next.minutes)
    const nextStatus = input.status || previousStatus
    if (scheduleChanged) {
      await ensureGoalAvailability(task, { userId, ...next }, transaction)
      await ensureNoOverlap({ userId, taskId, ...next }, transaction)
    }

    const status = nextStatus === 'Completed' ? 'COMPLETED' : taskStatus[nextStatus]
    const updatedTask = await transaction.dailyTask.update({
      where: { id: taskId },
      data: {
        title: next.activity,
        description: next.description,
        category: next.category,
        priority: taskPriority[next.priority],
        estimatedMinutes: next.minutes,
        notes: next.notes,
        status,
        completedAt: status === 'COMPLETED' ? task.completedAt || new Date() : null,
        retakeInProgress: task.retakeInProgress,
      },
    })
    const schedule = scheduleChanged
      ? await saveSchedule(transaction, task, currentSchedule, next, nextStatus)
      : (status === 'COMPLETED' && currentSchedule?.status !== 'COMPLETED'
        ? await transaction.taskSchedule.update({ where: { id: currentSchedule.id }, data: { status: 'COMPLETED' } })
        : currentSchedule)
    if (status === 'COMPLETED' && task.status !== 'COMPLETED') {
      await transaction.taskCompletion.create({
        data: { userId, taskId, completedAt: updatedTask.completedAt, notes: next.notes },
      })
    }
    const completions = task.status === 'COMPLETED'
      ? task.completions
      : (status === 'COMPLETED'
        ? [...task.completions, { completedAt: updatedTask.completedAt, notes: next.notes }]
        : task.completions)
    return taskResponse({ ...updatedTask, goal: task.goal, completions, retakeInProgress: task.retakeInProgress, retakeNote: task.retakeNote }, schedule)
  })
}

export async function startTaskRetake(taskId, userId, prisma = getPrismaClient()) {
  return prisma.$transaction(async (transaction) => {
    const task = await findOwnedTask(taskId, userId, transaction)
    if (task.status !== 'COMPLETED') {
      throw new HttpError(409, 'TASK_NOT_COMPLETED', 'Only completed tasks can be retaken.')
    }
    if (task.retakeInProgress) {
      throw new HttpError(409, 'RETAKE_ALREADY_IN_PROGRESS', 'A retake is already in progress.')
    }
    const updated = await transaction.dailyTask.update({
      where: { id: taskId },
      data: { retakeInProgress: true },
    })
    return taskResponse({ ...updated, goal: task.goal, completions: task.completions }, task.schedules[0] || null)
  })
}

export async function completeTaskRetake(taskId, notes, userId, prisma = getPrismaClient()) {
  return prisma.$transaction(async (transaction) => {
    const task = await findOwnedTask(taskId, userId, transaction)
    if (task.status !== 'COMPLETED' || !task.retakeInProgress) {
      throw new HttpError(409, 'NO_RETAKE_IN_PROGRESS', 'Start a task retake before recording its completion.')
    }
    const completedAt = new Date()
    await transaction.taskCompletion.create({
      data: { userId, taskId, completedAt, notes },
    })
    const updated = await transaction.dailyTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', completedAt, retakeInProgress: false },
    })
    const schedule = task.schedules[0] || null
    if (schedule && schedule.status !== 'COMPLETED') {
      await transaction.taskSchedule.update({
        where: { id: schedule.id },
        data: { status: 'COMPLETED' },
      })
    }
    return taskResponse({
      ...updated,
      goal: task.goal,
      completions: [...task.completions, { completedAt, notes }],
    }, schedule ? { ...schedule, status: 'COMPLETED' } : null)
  })
}

export async function deletePersonalTask(taskId, userId, prisma = getPrismaClient()) {
  const task = await findOwnedTask(taskId, userId, prisma)
  if (task.goalId) {
    throw new HttpError(403, 'GOAL_TASK_DELETE_FORBIDDEN', 'Goal roadmap tasks must be edited in Goal Instructor.')
  }
  await prisma.dailyTask.deleteMany({ where: { id: taskId, userId, goalId: null } })
}
