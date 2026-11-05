import { getPrismaClient } from '../config/database.js'
import { HttpError } from '../middleware/httpError.js'

const themeValues = { light: 'LIGHT', dark: 'DARK', system: 'SYSTEM' }

function publicPreferences(preferences) {
  return {
    theme: preferences.theme.toLowerCase(),
    notificationsEnabled: preferences.notificationsEnabled,
    preferredLanguage: preferences.preferredLanguage,
    dailyStudyHours: preferences.dailyStudyHours,
    timezone: preferences.timezone,
    wakeTime: preferences.wakeTime,
    sleepTime: preferences.sleepTime,
    availableDays: preferences.availableDays,
    settings: preferences.settings,
  }
}

async function findUser(userId, prisma) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preferences: true },
  })
  if (!user || user.isActive === false) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'The requested account was not found.')
  }
  return user
}

export async function getUserProfile(userId, prisma = getPrismaClient()) {
  const user = await findUser(userId, prisma)
  return {
    user: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      profileImage: user.profileImage || null,
      createdAt: user.createdAt,
    },
    profileDetails: user.preferences?.settings?.profileDetails || {},
  }
}

export async function updateUserProfile(userId, input, prisma = getPrismaClient()) {
  const existing = await findUser(userId, prisma)
  const data = { displayName: input.name }
  if (input.profileImage !== undefined) data.profileImage = input.profileImage
  await prisma.user.update({ where: { id: userId }, data })

  if (input.profileDetails !== undefined) {
    const settings = { ...(existing.preferences?.settings || {}), profileDetails: input.profileDetails }
    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, settings },
      update: { settings },
    })
  }

  return getUserProfile(userId, prisma)
}

export async function getUserPreferences(userId, prisma = getPrismaClient()) {
  await findUser(userId, prisma)
  const preferences = await prisma.userPreferences.findUnique({ where: { userId } })
  if (!preferences) {
    return {
      theme: 'system',
      notificationsEnabled: true,
      preferredLanguage: 'English',
      dailyStudyHours: null,
      timezone: 'UTC',
      wakeTime: null,
      sleepTime: null,
      availableDays: [],
      settings: {},
    }
  }
  return publicPreferences(preferences)
}

export async function updateUserPreferences(userId, input, prisma = getPrismaClient()) {
  await findUser(userId, prisma)
  const current = await prisma.userPreferences.findUnique({ where: { userId } })
  const data = {}
  if (input.theme !== undefined) data.theme = themeValues[input.theme]
  if (input.notificationsEnabled !== undefined) data.notificationsEnabled = input.notificationsEnabled
  if (input.preferredLanguage !== undefined) data.preferredLanguage = input.preferredLanguage
  if (input.dailyStudyHours !== undefined) data.dailyStudyHours = input.dailyStudyHours
  if (input.timezone !== undefined) data.timezone = input.timezone
  if (input.wakeTime !== undefined) data.wakeTime = input.wakeTime
  if (input.sleepTime !== undefined) data.sleepTime = input.sleepTime
  if (input.settings !== undefined) {
    data.settings = { ...(current?.settings || {}), ...input.settings }
  }

  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
  return publicPreferences(preferences)
}

export async function getDashboard(userId, prisma = getPrismaClient(), now = new Date()) {
  const user = await findUser(userId, prisma)
  const timezone = user.preferences?.timezone || 'UTC'
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const date = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const start = new Date(`${date.year}-${date.month}-${date.day}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const [goals, taskCount, completedTasks, scheduledTasks] = await Promise.all([
    prisma.goal.findMany({
      where: { userId },
      include: { dailyTasks: { select: { id: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.dailyTask.count({ where: { userId } }),
    prisma.dailyTask.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.taskSchedule.findMany({
      where: {
        userId,
        scheduledDate: { gte: start, lt: end },
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        supersededBy: { none: {} },
      },
      include: { task: true },
      orderBy: { startsAt: 'asc' },
    }),
  ])
  const completedGoals = goals.filter((goal) => goal.status === 'COMPLETED').length
  const todayTasks = scheduledTasks.map(({ task, ...schedule }) => ({
    id: task.id,
    title: task.title,
    status: task.status.toLowerCase(),
    scheduledDate: schedule.scheduledDate.toISOString().slice(0, 10),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  }))
  const completedToday = todayTasks.filter((task) => task.status === 'completed')
  const pendingToday = todayTasks.filter((task) => task.status !== 'completed')
  const activeGoals = goals.filter((goal) => goal.status === 'ACTIVE').length
  const pendingTasks = taskCount - completedTasks
  return {
    user: {
      id: user.id,
      name: user.displayName,
      email: user.email,
      profileImage: user.profileImage || null,
    },
    goals: {
      total: goals.length,
      active: activeGoals,
      completed: completedGoals,
      items: goals.map((goal) => {
        const totalTasks = goal.dailyTasks.length
        const completed = goal.dailyTasks.filter((task) => task.status === 'COMPLETED').length
        return {
          id: goal.id,
          title: goal.title,
          status: goal.status.toLowerCase(),
          targetDate: goal.targetDate?.toISOString().slice(0, 10) || null,
          progress: totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100),
        }
      }),
    },
    tasks: {
      total: taskCount,
      completed: completedTasks,
      pending: pendingTasks,
      progress: taskCount === 0 ? 0 : Math.round((completedTasks / taskCount) * 100),
    },
    today: todayTasks,
    todayTasks,
    completedTasks: completedToday,
    pendingTasks: pendingToday,
    statistics: {
      totalGoals: goals.length,
      activeGoals,
      completedGoals,
      totalTasks: taskCount,
      completedTasks: taskCount - pendingTasks,
      pendingTasks,
      todayTasks: todayTasks.length,
      completedToday: completedToday.length,
      pendingToday: pendingToday.length,
    },
  }
}
