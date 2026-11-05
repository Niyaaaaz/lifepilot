import { randomUUID } from 'node:crypto'
import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'
import { updateDailyTask } from './dailyTasks.service.js'
import { adjustTimetableWithAI, generateTimetableWithAI } from './aiTimetable.service.js'

const priorityLabel = { HIGH: 'High', NORMAL: 'Normal', LOW: 'Low' }
const taskStatusLabel = { NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' }
const scheduleStatuses = ['SCHEDULED', 'COMPLETED']

function dateObject(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

function dateKey(value) {
  return value.toISOString().slice(0, 10)
}

function addDays(value, days) {
  const date = dateObject(value)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function timeMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function durationBetween(startTime, endTime) {
  return timeMinutes(endTime) - timeMinutes(startTime)
}

function endTimeFor(startTime, minutes) {
  const total = timeMinutes(startTime) + minutes
  if (total >= 1440) throw new HttpError(400, 'INVALID_ACTIVITY_TIME', 'Timetable activities must end before midnight.')
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function rangeEnd(startDate, range) {
  return addDays(startDate, range === 'weekly' ? 6 : 0)
}

function validateNoOverlaps(activities) {
  const active = activities.filter((activity) => activity.status !== 'Skipped')
    .sort((left, right) => `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`))
  for (let index = 1; index < active.length; index += 1) {
    const previous = active[index - 1]
    const current = active[index]
    if (
      previous.date === current.date
      && timeMinutes(current.startTime) < timeMinutes(previous.endTime)
    ) {
      throw new HttpError(
        409,
        'TIMETABLE_OVERLAP',
        `“${current.activity}” overlaps “${previous.activity}” on ${current.date}.`,
      )
    }
  }
}

function makeActivity(data) {
  const minutes = data.minutes ?? durationBetween(data.startTime, data.endTime)
  return {
    id: data.id || randomUUID(),
    date: data.date,
    activity: data.activity,
    startTime: data.startTime,
    endTime: data.endTime || endTimeFor(data.startTime, minutes),
    minutes,
    priority: data.priority || 'Normal',
    category: data.category || 'Personal',
    description: data.description || '',
    relatedGoalId: data.relatedGoalId || null,
    dailyTaskId: data.dailyTaskId || null,
    status: data.status || 'Planned',
    fixed: Boolean(data.fixed),
  }
}

function fixedInputActivities(preferences, dates) {
  const fixed = [
    ...(preferences.collegeWork || []),
    ...(preferences.fitness || []),
    ...(preferences.fixedCommitments || []),
    ...(preferences.mealTimes || []),
    ...(preferences.customActivities || []).filter((activity) => activity.startTime && activity.endTime),
  ]
  return dates.flatMap((date) => fixed.map((item) => makeActivity({
    date,
    activity: item.activity,
    startTime: item.startTime,
    endTime: item.endTime,
    minutes: durationBetween(item.startTime, item.endTime),
    category: item.category,
    description: item.description,
    priority: item.priority || 'Normal',
    status: 'Planned',
    fixed: true,
  })))
}

function scheduledActivity(schedule) {
  const task = schedule.task
  if (!schedule.startTime) return null
  const endTime = schedule.endTime || endTimeFor(schedule.startTime, task.estimatedMinutes)
  return makeActivity({
    date: dateKey(schedule.scheduledDate),
    activity: task.title,
    startTime: schedule.startTime,
    endTime,
    minutes: durationBetween(schedule.startTime, endTime),
    priority: priorityLabel[task.priority] || 'Normal',
    category: task.goal?.category || task.category || 'Personal',
    description: task.description,
    relatedGoalId: task.goalId,
    dailyTaskId: task.id,
    status: taskStatusLabel[task.status] === 'Completed' ? 'Completed' : 'Planned',
    fixed: true,
  })
}

async function loadPlanningContext(userId, startDate, endDate, prisma) {
  const [goals, tasks, schedules, preferences] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { milestones: { where: { status: 'PENDING' }, orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ targetDate: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.dailyTask.findMany({
      where: { userId, status: { not: 'COMPLETED' } },
      include: {
        goal: true,
        schedules: { where: { supersededBy: { none: {} } }, orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.taskSchedule.findMany({
      where: {
        userId,
        scheduledDate: { gte: dateObject(startDate), lte: dateObject(endDate) },
        status: { in: scheduleStatuses },
        supersededBy: { none: {} },
      },
      include: { task: { include: { goal: true } } },
      orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ])
  const scheduledIds = new Set(schedules.map((schedule) => schedule.taskId))
  const availableTasks = tasks
    .filter((task) => (!task.goalId || task.goal?.status === 'ACTIVE')
      && !scheduledIds.has(task.id)
      && task.schedules.length === 0)
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: priorityLabel[task.priority] || 'Normal',
      estimatedMinutes: task.estimatedMinutes,
      goalId: task.goalId,
      goalTitle: task.goal?.title || '',
    }))
  const goalContext = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    targetDate: goal.targetDate ? dateKey(goal.targetDate) : null,
    priority: goal.roadmapData?.priority || 'Normal',
    milestones: goal.milestones.map((milestone) => ({
      title: milestone.title,
      description: milestone.description,
      targetDate: milestone.targetDate ? dateKey(milestone.targetDate) : null,
    })),
  }))
  return {
    goals: goalContext,
    availableTasks,
    existingActivities: schedules
      .filter((schedule) => !schedule.task.goalId || schedule.task.goal?.status === 'ACTIVE')
      .map(scheduledActivity)
      .filter(Boolean),
    accountPreferences: preferences ? {
      wakeTime: preferences.wakeTime,
      sleepTime: preferences.sleepTime,
      studyHours: preferences.dailyStudyHours,
      availableDays: preferences.availableDays,
      timezone: preferences.timezone,
    } : null,
  }
}

function aiActivities(result, { dates, goals, availableTasks }) {
  const goalIds = new Set(goals.map((goal) => goal.id))
  const taskIds = new Set(availableTasks.map((task) => task.id))
  const linkedTasks = new Set()
  return result.activities.map((item) => {
    if (!dates.includes(item.date)) {
      throw new HttpError(502, 'AI_INVALID_SCHEDULE', 'The AI returned an activity outside the requested date range.')
    }
    if (item.dailyTaskId && !taskIds.has(item.dailyTaskId)) {
      throw new HttpError(502, 'AI_INVALID_TASK_LINK', 'The AI linked an activity to a task that is not available to your account.')
    }
    if (item.dailyTaskId && linkedTasks.has(item.dailyTaskId)) {
      throw new HttpError(502, 'AI_DUPLICATE_TASK', 'The AI scheduled the same Daily Instructor task more than once.')
    }
    if (item.dailyTaskId) linkedTasks.add(item.dailyTaskId)
    if (item.relatedGoalId && !goalIds.has(item.relatedGoalId)) {
      throw new HttpError(502, 'AI_INVALID_GOAL_LINK', 'The AI linked an activity to a goal that is not available to your account.')
    }
    const actualDuration = durationBetween(item.startTime, item.endTime)
    if (actualDuration !== item.minutes || actualDuration <= 0) {
      throw new HttpError(502, 'AI_INVALID_DURATION', 'The AI returned an activity with an inconsistent duration.')
    }
    return makeActivity({ ...item, id: randomUUID(), status: 'Planned', fixed: false })
  })
}

async function syncLinkedTasks(activities, userId, prisma) {
  for (const activity of activities) {
    if (!activity.dailyTaskId) continue
    const task = await prisma.dailyTask.findFirst({
      where: { id: activity.dailyTaskId, userId },
      select: { id: true, status: true },
    })
    if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'A linked Daily Instructor task was not found.')
    if (task.status === 'COMPLETED' && activity.status !== 'Completed') {
      throw new HttpError(409, 'COMPLETED_TASK_LOCKED', 'Completed Daily Instructor tasks cannot be reopened from the timetable.')
    }
    await updateDailyTask(task.id, {
      activity: activity.activity,
      description: activity.description,
      category: activity.category,
      priority: activity.priority,
      date: activity.date,
      startTime: activity.startTime,
      minutes: activity.minutes,
      ...(activity.status === 'Completed' ? { status: 'Completed' } : {}),
    }, userId, prisma)
  }
}

async function timetableResponse(record, prisma) {
  const activities = Array.isArray(record.activities) ? record.activities : []
  const taskIds = [...new Set(activities.map((activity) => activity.dailyTaskId).filter(Boolean))]
  if (!taskIds.length) return { ...record, activities }
  const tasks = await prisma.dailyTask.findMany({
    where: { userId: record.userId, id: { in: taskIds } },
    select: { id: true, status: true },
  })
  const statusById = new Map(tasks.map((task) => [task.id, task.status]))
  return {
    ...record,
    activities: activities.map((activity) => ({
      ...activity,
      status: statusById.get(activity.dailyTaskId) === 'COMPLETED' ? 'Completed' : activity.status,
    })),
  }
}

export async function generateTimetable(input, userId, {
  prisma = getPrismaClient(),
  aiGenerator = generateTimetableWithAI,
} = {}) {
  const endDate = rangeEnd(input.startDate, input.range)
  const dates = Array.from({ length: input.range === 'weekly' ? 7 : 1 }, (_, index) => addDays(input.startDate, index))
  const context = await loadPlanningContext(userId, input.startDate, endDate, prisma)
  const fixedActivities = [
    ...fixedInputActivities(input.preferences, dates),
    ...context.existingActivities,
  ]
  validateNoOverlaps(fixedActivities)

  const result = await aiGenerator({
    range: input.range,
    startDate: input.startDate,
    endDate,
    dates,
    preferences: input.preferences,
    accountPreferences: context.accountPreferences,
    goals: context.goals,
    pendingTasks: context.availableTasks,
    busyBlocks: fixedActivities.map(({ id, date, activity, startTime, endTime, category }) => ({
      id, date, activity, startTime, endTime, category,
    })),
  })
  if (result.clarificationQuestions.length) {
    return { clarificationQuestions: result.clarificationQuestions }
  }
  const generated = aiActivities(result, { dates, ...context })
  const activities = [...fixedActivities, ...generated]
  validateNoOverlaps(activities)

  const record = await prisma.$transaction(async (transaction) => {
    await syncLinkedTasks(generated, userId, transaction)
    return transaction.timetable.create({
      data: {
        userId,
        startDate: dateObject(input.startDate),
        durationDays: dates.length,
        activities,
        generationInput: input.preferences,
        generationMetadata: { provider: 'openai', model: result.model || 'unknown', generatedAt: new Date().toISOString() },
      },
    })
  })
  return { timetable: await timetableResponse(record, prisma) }
}

export async function listTimetables(userId, query, prisma = getPrismaClient()) {
  const records = await prisma.timetable.findMany({
    where: {
      userId,
      ...(query.from || query.to ? {
        startDate: {
          ...(query.from ? { gte: dateObject(query.from) } : {}),
          ...(query.to ? { lte: dateObject(query.to) } : {}),
        },
      } : {}),
      ...(query.range ? { durationDays: query.range === 'weekly' ? 7 : 1 } : {}),
    },
    orderBy: [{ startDate: 'desc' }, { updatedAt: 'desc' }],
  })
  return Promise.all(records.map((record) => timetableResponse(record, prisma)))
}

export async function getTimetable(id, userId, prisma = getPrismaClient()) {
  const record = await prisma.timetable.findFirst({ where: { id, userId } })
  if (!record) throw new HttpError(404, 'TIMETABLE_NOT_FOUND', 'The requested timetable was not found.')
  return timetableResponse(record, prisma)
}

function assertCompletedUnchanged(previous, nextActivities) {
  const nextById = new Map(nextActivities.map((activity) => [activity.id, activity]))
  for (const activity of previous.activities) {
    if (activity.status !== 'Completed') continue
    const next = nextById.get(activity.id)
    const immutableFields = ['date', 'activity', 'startTime', 'endTime', 'minutes', 'priority', 'category', 'description', 'relatedGoalId', 'dailyTaskId', 'fixed']
    if (!next || immutableFields.some((field) => activity[field] !== next[field]) || next.status !== 'Completed') {
      throw new HttpError(409, 'COMPLETED_ACTIVITY_LOCKED', 'Completed timetable activities cannot be moved, edited, or deleted.')
    }
  }
}

function ensureLinksBelongToUser(activities, userId, prisma) {
  return Promise.all([
    prisma.goal.findMany({
      where: { userId, id: { in: [...new Set(activities.map((activity) => activity.relatedGoalId).filter(Boolean))] } },
      select: { id: true },
    }),
    prisma.dailyTask.findMany({
      where: { userId, id: { in: [...new Set(activities.map((activity) => activity.dailyTaskId).filter(Boolean))] } },
      select: { id: true },
    }),
  ]).then(([goals, tasks]) => {
    const goalIds = new Set(goals.map((goal) => goal.id))
    const taskIds = new Set(tasks.map((task) => task.id))
    if (activities.some((activity) => activity.relatedGoalId && !goalIds.has(activity.relatedGoalId))) {
      throw new HttpError(404, 'GOAL_NOT_FOUND', 'A linked goal was not found for this account.')
    }
    if (activities.some((activity) => activity.dailyTaskId && !taskIds.has(activity.dailyTaskId))) {
      throw new HttpError(404, 'TASK_NOT_FOUND', 'A linked Daily Instructor task was not found for this account.')
    }
  })
}

export async function updateTimetable(id, userId, activities, prisma = getPrismaClient()) {
  const current = await prisma.timetable.findFirst({ where: { id, userId } })
  if (!current) throw new HttpError(404, 'TIMETABLE_NOT_FOUND', 'The requested timetable was not found.')
  const currentState = await timetableResponse(current, prisma)
  const firstDate = dateKey(current.startDate)
  const lastDate = addDays(firstDate, current.durationDays - 1)
  if (activities.some((activity) => activity.date < firstDate || activity.date > lastDate)) {
    throw new HttpError(400, 'ACTIVITY_OUTSIDE_TIMETABLE', 'Activities must stay within the saved timetable date range.')
  }
  assertCompletedUnchanged(currentState, activities)
  const taskIds = activities.map((activity) => activity.dailyTaskId).filter(Boolean)
  if (new Set(taskIds).size !== taskIds.length) {
    throw new HttpError(409, 'DUPLICATE_TASK_ACTIVITY', 'A Daily Instructor task can only appear once in a timetable.')
  }
  await ensureLinksBelongToUser(activities, userId, prisma)
  validateNoOverlaps(activities)
  const previousIds = new Set(currentState.activities.map((activity) => activity.id))
  const changedLinked = activities.filter((activity) => activity.dailyTaskId
    && (!previousIds.has(activity.id) || JSON.stringify(currentState.activities.find((item) => item.id === activity.id)) !== JSON.stringify(activity)))
  const updated = await prisma.$transaction(async (transaction) => {
    await syncLinkedTasks(changedLinked, userId, transaction)
    return transaction.timetable.update({
      where: { id },
      data: { activities },
    })
  })
  return timetableResponse(updated, prisma)
}

function adjustedActivityItems(result, previousActivities) {
  const byTask = new Map(previousActivities.filter((activity) => activity.dailyTaskId)
    .map((activity) => [activity.dailyTaskId, activity]))
  const remaining = [...previousActivities]
  return result.activities.map((item) => {
    let matchedIndex = item.id
      ? remaining.findIndex((activity) => activity.id === item.id)
      : -1
    if (matchedIndex < 0 && item.dailyTaskId) {
      matchedIndex = remaining.findIndex((activity) => activity.dailyTaskId === item.dailyTaskId)
    }
    if (matchedIndex < 0) {
      matchedIndex = remaining.findIndex((activity) => activity.activity === item.activity && activity.date === item.date)
    }
    const previous = matchedIndex >= 0 ? remaining.splice(matchedIndex, 1)[0] : null
    const matchedTask = item.dailyTaskId ? byTask.get(item.dailyTaskId) : null
    if (previous?.status === 'Completed') return previous
    return makeActivity({
      ...item,
      id: previous?.id || matchedTask?.id || randomUUID(),
      status: previous?.status || item.status || 'Planned',
      fixed: previous?.fixed || false,
    })
  })
}

export async function adjustTimetable(id, userId, instruction, {
  prisma = getPrismaClient(),
  aiAdjuster = adjustTimetableWithAI,
} = {}) {
  const current = await getTimetable(id, userId, prisma)
  const endDate = addDays(dateKey(current.startDate), current.durationDays - 1)
  const result = await aiAdjuster({
    instruction,
    startDate: dateKey(current.startDate),
    endDate,
    generationInput: current.generationInput,
    activities: current.activities,
  })
  if (result.clarificationQuestions.length) {
    return { clarificationQuestions: result.clarificationQuestions }
  }
  const activities = adjustedActivityItems(result, current.activities)
  for (const completed of current.activities.filter((item) => item.status === 'Completed')) {
    if (!activities.some((item) => item.id === completed.id)) activities.push(completed)
  }
  const saved = await updateTimetable(id, userId, activities, prisma)
  await prisma.timetable.update({
    where: { id },
    data: { generationMetadata: { provider: 'openai', model: result.model || 'unknown', adjustedAt: new Date().toISOString() } },
  })
  return { timetable: saved }
}

export async function deleteTimetable(id, userId, prisma = getPrismaClient()) {
  const result = await prisma.timetable.deleteMany({ where: { id, userId } })
  if (result.count !== 1) throw new HttpError(404, 'TIMETABLE_NOT_FOUND', 'The requested timetable was not found.')
}
