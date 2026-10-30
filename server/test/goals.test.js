import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { after, before, test } from 'node:test'
import { createGoalsRouter } from '../src/routes/goals.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { parseCookies } from '../src/middleware/cookies.js'
import { HttpError } from '../src/middleware/httpError.js'

const origin = 'http://127.0.0.1:4173'
const userA = randomUUID()
const userB = randomUUID()
const tables = {
  goals: [],
  monthlyObjectives: [],
  weeklyObjectives: [],
  goalMilestones: [],
  dailyTasks: [],
  taskCompletions: [],
  taskSchedules: [],
}
let server
let baseUrl

function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => record[key] === value)
}

function delegate(tableName) {
  const rows = tables[tableName]
  return {
    async create({ data }) {
      const row = { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data }
      rows.push(row)
      return row
    },
    async findFirst({ where }) {
      return rows.find((row) => matches(row, where)) || null
    },
    async findMany({ where = {}, include } = {}) {
      const selected = rows.filter((row) => matches(row, where))
      if (tableName !== 'dailyTasks' || !include) return selected
      return selected.map((task) => ({
        ...task,
        completions: tables.taskCompletions
          .filter((completion) => completion.taskId === task.id && completion.userId === task.userId)
          .sort((a, b) => a.completedAt - b.completedAt),
        schedules: tables.taskSchedules
          .filter((schedule) => schedule.taskId === task.id && schedule.userId === task.userId)
          .sort((a, b) => b.createdAt - a.createdAt),
      }))
    },
    async update({ where, data }) {
      const row = rows.find((record) => matches(record, where))
      assert.ok(row, `Expected ${tableName} record to exist`)
      Object.assign(row, data, { updatedAt: new Date() })
      return row
    },
    async deleteMany({ where }) {
      const deleted = rows.filter((row) => matches(row, where))
      const retained = rows.filter((row) => !matches(row, where))
      const count = rows.length - retained.length
      rows.splice(0, rows.length, ...retained)
      if (tableName === 'goals' && count) {
        const goalIds = new Set(deleted.map((row) => row.id))
        for (const related of ['monthlyObjectives', 'weeklyObjectives', 'goalMilestones', 'dailyTasks']) {
          tables[related] = tables[related].filter((row) => goalIds.has(row.goalId))
        }
      }
      if (tableName === 'dailyTasks' && count) {
        const taskIds = new Set(tables.dailyTasks.map((task) => task.id))
        tables.taskCompletions = tables.taskCompletions.filter((row) => taskIds.has(row.taskId))
        tables.taskSchedules = tables.taskSchedules.filter((row) => taskIds.has(row.taskId))
      }
      if (tableName === 'weeklyObjectives' && count) {
        const phaseIds = new Set(tables.weeklyObjectives.map((phase) => phase.id))
        tables.dailyTasks = tables.dailyTasks.filter((task) => phaseIds.has(task.weeklyObjectiveId))
      }
      return { count }
    },
    async count({ where }) {
      return rows.filter((row) => matches(row, where)).length
    },
  }
}

function createMemoryPrisma() {
  return {
    goal: {
      ...delegate('goals'),
      async findMany({ where }) {
        return tables.goals.filter((goal) => matches(goal, where))
      },
    },
    monthlyObjective: delegate('monthlyObjectives'),
    weeklyObjective: delegate('weeklyObjectives'),
    goalMilestone: delegate('goalMilestones'),
    dailyTask: delegate('dailyTasks'),
    taskCompletion: delegate('taskCompletions'),
    taskSchedule: delegate('taskSchedules'),
    async $transaction(callback) {
      return callback(this)
    },
  }
}

const database = createMemoryPrisma()
const authenticateTestUser = (request, _response, next) => {
  const token = request.cookies?.test_session
  const userId = token === 'user-a' ? userA : token === 'user-b' ? userB : null
  if (!userId) {
    next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.'))
    return
  }
  if (!request.auth) {
    request.auth = { userId }
  } else {
    request.auth.userId = userId
  }
  next()
}

function apiRequest(path, token = 'user-a', options = {}) {
  return fetch(`${baseUrl}/api/goals${path}`, {
    ...options,
    headers: {
      Origin: origin,
      Cookie: `test_session=${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

const goalBody = {
  title: 'Learn secure web development',
  description: 'Build practical application security skills.',
  current: 'Beginner',
  outcome: 'Complete a small reviewed project.',
  durationAmount: 8,
  durationUnit: 'weeks',
  durationDays: 56,
  startDate: '2026-10-30',
  targetDate: '2026-12-24',
  status: 'active',
  category: 'Coding and Programming',
  hoursPerDay: 1,
  preferredDays: [1, 3, 5],
  availableStartTime: '18:00',
  availableEndTime: '20:00',
  skills: 'HTML',
  resources: 'Official docs',
  limitations: '',
  style: 'Hands-on',
  budget: '',
  instructions: '',
  resourceGuidance: 'Use official material.',
  challengeGuidance: 'Keep the scope small.',
  estimatedHours: 2,
  daysNeeded: 2,
  phases: [{
    weekNumber: 1,
    monthNumber: 1,
    monthKey: 'month-1',
    monthLabel: 'Month 1',
    name: 'Build the foundation',
    objective: 'Learn the basics.',
    completionCriteria: 'Create a small exercise.',
    startDate: '2026-10-30',
    endDate: '2026-11-05',
    tasks: [{
      scheduleKey: 'week-1-weekday-5',
      title: 'Review secure input handling',
      detail: 'Read official guidance and practice.',
      priority: 'High',
      minutes: 45,
      status: 'Not Started',
      completed: false,
      completedAt: null,
      notes: '',
      scheduledDate: '2026-10-30',
      startTime: '18:00',
      endTime: '18:45',
      isGoalRepetition: false,
      completionHistory: [],
    }],
  }],
  milestones: [{
    monthKey: 'month-1',
    title: 'First monthly milestone',
    outcome: 'Complete the foundations.',
    date: '2026-11-26',
  }],
}

before(async () => {
  const app = express()
  app.use(express.json())
  app.use(parseCookies)
  app.use('/api/goals', createGoalsRouter({
    prismaProvider: () => database,
    requireAuth: authenticateTestUser,
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

test('authenticated goal endpoints persist roadmap data and isolate every user', async () => {
  const unauthorized = await apiRequest('', 'anonymous')
  assert.equal(unauthorized.status, 401)

  const createdResponse = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify({ ...goalBody, legacyId: 'legacy-goal-1' }),
  })
  assert.equal(createdResponse.status, 201)
  const { goal: created } = await createdResponse.json()
  assert.equal(created.title, goalBody.title)
  assert.equal(created.durationAmount, goalBody.durationAmount)
  assert.equal(created.durationUnit, goalBody.durationUnit)
  assert.equal(created.progress, 0)
  assert.equal(created.monthlyObjectives.length, 1)
  assert.equal(created.milestones.length, 1)
  assert.equal(created.phases[0].tasks[0].startTime, '18:00')

  const retriedImport = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify({ ...goalBody, legacyId: 'legacy-goal-1' }),
  })
  assert.equal((await retriedImport.json()).goal.id, created.id)

  const ownList = await apiRequest('', 'user-a')
  assert.equal((await ownList.json()).goals.length, 1)
  const otherList = await apiRequest('', 'user-b')
  assert.deepEqual((await otherList.json()).goals, [])
  assert.equal((await apiRequest(`/${created.id}`, 'user-b')).status, 404)

  const task = created.phases[0].tasks[0]
  const updatedBody = {
    ...goalBody,
    description: 'Updated and completed without losing history.',
    phases: [{
      ...goalBody.phases[0],
      tasks: [{
        ...goalBody.phases[0].tasks[0],
        id: task.id,
        status: 'Completed',
        completed: true,
        completedAt: '2026-10-30T12:00:00.000Z',
        completionHistory: [{ completedAt: '2026-10-30T12:00:00.000Z', notes: 'First completion' }],
      }],
    }],
  }
  const patchedResponse = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify(updatedBody),
  })
  assert.equal(patchedResponse.status, 200)
  const { goal: updated } = await patchedResponse.json()
  assert.equal(updated.description, updatedBody.description)
  assert.equal(updated.progress, 100)
  assert.equal(updated.phases[0].tasks[0].completionHistory.length, 1)

  const secondCompletion = {
    ...updatedBody,
    phases: [{
      ...updatedBody.phases[0],
      tasks: [{
        ...updatedBody.phases[0].tasks[0],
        completionHistory: [
          ...updatedBody.phases[0].tasks[0].completionHistory,
          { completedAt: '2026-10-30T13:00:00.000Z', notes: 'Second completion' },
        ],
      }],
    }],
  }
  const repeated = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify(secondCompletion),
  })
  const { goal: repeatedGoal } = await repeated.json()
  assert.equal(repeatedGoal.progress, 100)
  assert.equal(repeatedGoal.phases[0].tasks[0].completionHistory.length, 2)

  const editedWithoutCompletedTask = {
    ...secondCompletion,
    phases: [{ ...secondCompletion.phases[0], tasks: [] }],
  }
  const editedResponse = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify(editedWithoutCompletedTask),
  })
  const { goal: edited } = await editedResponse.json()
  assert.equal(edited.phases[0].tasks.length, 1)
  assert.equal(edited.phases[0].tasks[0].completionHistory.length, 2)
  assert.equal(edited.progress, 100)

  const deniedPatch = await apiRequest(`/${created.id}`, 'user-b', {
    method: 'PATCH',
    body: JSON.stringify(updatedBody),
  })
  assert.equal(deniedPatch.status, 404)
  assert.equal((await apiRequest(`/${created.id}`, 'user-b', { method: 'DELETE' })).status, 404)

  const deleted = await apiRequest(`/${created.id}`, 'user-a', { method: 'DELETE' })
  assert.equal(deleted.status, 204)
  assert.deepEqual((await (await apiRequest('', 'user-a')).json()).goals, [])
})

test('goal API rejects invalid user-selected durations and nested task values', async () => {
  const invalidDuration = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify({ ...goalBody, durationAmount: 0 }),
  })
  assert.equal(invalidDuration.status, 400)

  const invalidTask = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify({
      ...goalBody,
      phases: [{ ...goalBody.phases[0], tasks: [{ ...goalBody.phases[0].tasks[0], minutes: 0 }] }],
    }),
  })
  assert.equal(invalidTask.status, 400)
})
