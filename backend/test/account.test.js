import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { after, before, test } from 'node:test'
import {
  createDashboardRouter,
  createPreferencesRouter,
  createUserRouter,
} from '../src/routes/account.routes.js'
import { createMilestonesRouter } from '../src/routes/milestones.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const userA = randomUUID()
const userB = randomUUID()
const goalA = randomUUID()
const users = new Map([
  [userA, { id: userA, displayName: 'Ada User', email: 'ada@example.com', passwordHash: 'secret-hash', isActive: true, createdAt: new Date() }],
  [userB, { id: userB, displayName: 'Lin User', email: 'lin@example.com', passwordHash: 'secret-hash', isActive: true, createdAt: new Date() }],
])
const preferences = new Map()
const goals = [{ id: goalA, userId: userA, status: 'ACTIVE' }]
const tasks = [
  { id: randomUUID(), userId: userA, title: 'Completed goal task', status: 'COMPLETED' },
  { id: randomUUID(), userId: userA, title: 'Pending goal task', status: 'NOT_STARTED' },
  { id: randomUUID(), userId: userB, title: 'Other user task', status: 'COMPLETED' },
]
const schedules = []
const milestones = []
let server
let baseUrl

const prisma = {
  user: {
    async findUnique({ where }) {
      const user = users.get(where.id)
      return user ? { ...user, preferences: preferences.get(user.id) || null } : null
    },
    async update({ where, data }) {
      const user = users.get(where.id)
      assert.ok(user)
      Object.assign(user, data)
      return user
    },
  },
  userPreferences: {
    async findUnique({ where }) {
      return preferences.get(where.userId) || null
    },
    async upsert({ where, create, update }) {
      const current = preferences.get(where.userId)
      const next = current
        ? { ...current, ...update, updatedAt: new Date() }
        : {
          theme: 'SYSTEM',
          notificationsEnabled: true,
          preferredLanguage: 'English',
          dailyStudyHours: null,
          timezone: 'UTC',
          wakeTime: null,
          sleepTime: null,
          availableDays: [],
          settings: {},
          ...create,
          updatedAt: new Date(),
        }
      preferences.set(where.userId, next)
      return next
    },
  },
  goal: {
    async findFirst({ where, select }) {
      const goal = goals.find((item) => item.id === where.id && item.userId === where.userId)
      return goal && select ? { id: goal.id } : goal || null
    },
    async findMany({ where }) {
      return goals.filter((goal) => goal.userId === where.userId)
        .map((goal) => ({
          ...goal,
          title: 'User goal',
          targetDate: null,
          dailyTasks: tasks.filter((task) => task.userId === goal.userId),
        }))
    },
  },
  dailyTask: {
    async count({ where }) {
      return tasks.filter((task) => task.userId === where.userId && (!where.status || task.status === where.status)).length
    },
  },
  taskSchedule: {
    async findMany({ where }) {
      return schedules.filter((schedule) => schedule.userId === where.userId
        && schedule.scheduledDate >= where.scheduledDate.gte
        && schedule.scheduledDate < where.scheduledDate.lt)
        .map((schedule) => ({ ...schedule, task: tasks.find((task) => task.id === schedule.taskId) }))
    },
  },
  goalMilestone: {
    async findMany({ where }) {
      return milestones.filter((item) => item.goalId === where.goalId && item.userId === where.userId)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    },
    async findFirst({ where }) {
      if (where.id) return milestones.find((item) => item.id === where.id && item.userId === where.userId) || null
      const found = milestones.filter((item) => item.goalId === where.goalId && item.userId === where.userId)
        .sort((left, right) => right.sortOrder - left.sortOrder)[0]
      return found ? { sortOrder: found.sortOrder } : null
    },
    async create({ data }) {
      const now = new Date()
      const milestone = { id: randomUUID(), ...data, createdAt: now, updatedAt: now }
      milestones.push(milestone)
      return milestone
    },
    async update({ where, data }) {
      const milestone = milestones.find((item) => item.id === where.id)
      assert.ok(milestone)
      Object.assign(milestone, data, { updatedAt: new Date() })
      return milestone
    },
    async deleteMany({ where }) {
      const index = milestones.findIndex((item) => item.id === where.id && item.userId === where.userId)
      if (index < 0) return { count: 0 }
      milestones.splice(index, 1)
      return { count: 1 }
    },
  },
}

function request(path, { userId = userA, ...options } = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: 'http://127.0.0.1:4173',
      'x-test-user': userId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/users', createUserRouter({
    prismaProvider: () => prisma,
    requireAuth: (request, _response, next) => {
      request.auth = { userId: request.get('x-test-user') || userA }
      next()
    },
  }))
  app.use('/api/preferences', createPreferencesRouter({
    prismaProvider: () => prisma,
    requireAuth: (request, _response, next) => {
      request.auth = { userId: request.get('x-test-user') || userA }
      next()
    },
  }))
  app.use('/api/dashboard', createDashboardRouter({
    prismaProvider: () => prisma,
    requireAuth: (request, _response, next) => {
      request.auth = { userId: request.get('x-test-user') || userA }
      next()
    },
  }))
  app.use('/api', createMilestonesRouter({
    prismaProvider: () => prisma,
    requireAuth: (request, _response, next) => {
      request.auth = { userId: request.get('x-test-user') || userA }
      next()
    },
  }))
  app.use(errorHandler)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('user profile API returns safe authenticated data and persists profile updates', async () => {
  const initial = await request('/api/users/me')
  const initialBody = await initial.json()
  assert.equal(initial.status, 200)
  assert.equal(initialBody.user.email, 'ada@example.com')
  assert.equal('passwordHash' in initialBody.user, false)

  const updated = await request('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Ada Lovelace',
      profileDetails: { username: 'adal', bio: 'A new bio' },
    }),
  })
  assert.equal(updated.status, 200)
  const body = await updated.json()
  assert.equal(body.user.name, 'Ada Lovelace')
  assert.deepEqual(body.profileDetails, { username: 'adal', bio: 'A new bio' })
})

test('preferences persist per authenticated user and reject invalid values', async () => {
  const response = await request('/api/preferences', {
    method: 'PATCH',
    body: JSON.stringify({
      theme: 'dark',
      timezone: 'Asia/Kolkata',
      preferredLanguage: 'Hindi',
      settings: {
        wake: '07:00',
        selectedAreas: ['Fitness'],
        instructorStyle: 'Calm',
        instructor: {
          suggestBreaks: false,
          moveUnfinishedTasks: true,
          askFollowUpQuestions: false,
          dailyMotivation: true,
        },
        notifications: {
          scheduleReminders: true,
          taskDeadlineReminders: true,
          goalProgressReminders: true,
          eveningReviewReminders: true,
          weeklySummary: false,
          emailNotifications: false,
          inAppNotifications: true,
        },
        privacy: { profileVisibility: false, aiPersonalization: true },
      },
    }),
  })
  assert.equal(response.status, 200)
  const saved = (await response.json()).preferences
  assert.equal(saved.theme, 'dark')
  assert.equal(saved.settings.wake, '07:00')
  assert.equal(saved.settings.instructor.suggestBreaks, false)
  assert.equal(saved.settings.notifications.emailNotifications, false)

  const otherUser = await request('/api/preferences', { userId: userB })
  assert.equal((await otherUser.json()).preferences.theme, 'system')
  const invalid = await request('/api/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ theme: 'ultraviolet' }),
  })
  assert.equal(invalid.status, 400)
})

test('dashboard returns only the signed-in user aggregate', async () => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
  schedules.push(
    { id: randomUUID(), userId: userA, taskId: tasks[0].id, scheduledDate: today, startTime: '09:00', endTime: '09:30', status: 'COMPLETED' },
    { id: randomUUID(), userId: userA, taskId: tasks[1].id, scheduledDate: today, startTime: '10:00', endTime: '10:30', status: 'SCHEDULED' },
  )
  const response = await request('/api/dashboard')
  assert.equal(response.status, 200)
  const body = (await response.json()).dashboard
  assert.deepEqual(body.user, {
    id: userA,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    profileImage: null,
  })
  assert.deepEqual(body.goals, {
    total: 1,
    active: 1,
    completed: 0,
    items: [{ id: goalA, title: 'User goal', status: 'active', targetDate: null, progress: 50 }],
  })
  assert.deepEqual(body.tasks, { total: 2, completed: 1, pending: 1, progress: 50 })
  assert.deepEqual(body.today.map(({ id, status }) => ({ id, status })), [
    { id: tasks[0].id, status: 'completed' },
    { id: tasks[1].id, status: 'not_started' },
  ])
  assert.deepEqual(body.todayTasks, body.today)
  assert.deepEqual(body.completedTasks.map((task) => task.id), [tasks[0].id])
  assert.deepEqual(body.pendingTasks.map((task) => task.id), [tasks[1].id])
  assert.deepEqual(body.statistics, {
    totalGoals: 1,
    activeGoals: 1,
    completedGoals: 0,
    totalTasks: 2,
    completedTasks: 1,
    pendingTasks: 1,
    todayTasks: 2,
    completedToday: 1,
    pendingToday: 1,
  })
})

test('milestone endpoints enforce goal and milestone ownership', async () => {
  const created = await request(`/api/goals/${goalA}/milestones`, {
    method: 'POST',
    body: JSON.stringify({ title: 'First milestone', dueDate: '2026-12-01' }),
  })
  assert.equal(created.status, 201)
  const milestone = (await created.json()).milestone
  assert.equal(milestone.status, 'pending')

  const listed = await request(`/api/goals/${goalA}/milestones`)
  assert.equal((await listed.json()).milestones.length, 1)

  const completed = await request(`/api/milestones/${milestone.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  })
  assert.equal((await completed.json()).milestone.status, 'completed')

  const otherUser = await request(`/api/goals/${goalA}/milestones`, { userId: userB })
  assert.equal(otherUser.status, 404)
  const forbiddenUpdate = await request(`/api/milestones/${milestone.id}`, {
    userId: userB,
    method: 'PATCH',
    body: JSON.stringify({ title: 'Stolen update' }),
  })
  assert.equal(forbiddenUpdate.status, 404)
})
