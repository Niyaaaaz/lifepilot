import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { after, before, test } from 'node:test'
import { parseCookies } from '../src/middleware/cookies.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { HttpError } from '../src/middleware/httpError.js'
import { createDailyTasksRouter } from '../src/routes/dailyTasks.routes.js'

const userA = randomUUID()
const userB = randomUUID()
const database = {
  goals: [],
  tasks: [],
  schedules: [],
  completions: [],
}
let server
let baseUrl

function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'task') return true
    if (key === 'supersededBy') {
      return value !== null || !database.schedules.some((candidate) => candidate.supersedesId === record.id)
    }
    if (key === 'goalId' && value === null) return record[key] === null
    if (key === 'scheduledDate' && value && typeof value === 'object') {
      return (!value.gte || record[key] >= value.gte) && (!value.lte || record[key] <= value.lte)
    }
    if (key === 'status' && value && typeof value === 'object') return value.in.includes(record[key])
    if (key === 'taskId' && value && typeof value === 'object') return record[key] !== value.not
    return record[key] === value
  })
}

function taskDetails(task, include = {}) {
  const schedules = database.schedules
    .filter((schedule) => schedule.taskId === task.id && schedule.userId === task.userId)
    .filter((schedule) => !database.schedules.some((candidate) => candidate.supersedesId === schedule.id))
    .sort((a, b) => b.createdAt - a.createdAt)
  const completions = database.completions
    .filter((completion) => completion.taskId === task.id && completion.userId === task.userId)
    .sort((a, b) => a.completedAt - b.completedAt)
  const goal = database.goals.find((item) => item.id === task.goalId && item.userId === task.userId) || null
  return {
    ...task,
    ...(include.goal ? { goal } : {}),
    ...(include.schedules ? { schedules } : {}),
    ...(include.completions ? { completions } : {}),
  }
}

function delegate(name) {
  const rows = database[name]
  return {
    async create({ data }) {
      const row = { id: randomUUID(), createdAt: new Date(), ...data }
      if (name === 'schedules') row.status = data.status || 'SCHEDULED'
      rows.push(row)
      return row
    },
    async findFirst({ where, include }) {
      const row = rows.find((item) => matches(item, where))
      if (!row || name !== 'tasks' || !include) return row || null
      return taskDetails(row, {
        goal: Boolean(include.goal),
        schedules: Boolean(include.schedules),
        completions: Boolean(include.completions),
      })
    },
    async findMany({ where = {}, include } = {}) {
      const found = rows.filter((item) => matches(item, where))
      if (name !== 'schedules' || !include?.task) return found
      return found.map((schedule) => {
        const task = database.tasks.find((item) => item.id === schedule.taskId)
        const decorated = taskDetails(task, {
          goal: include.task === true || Boolean(include.task.include?.goal),
          completions: true,
        })
        if (include.task !== true && include.task.is?.OR) {
          const eligible = include.task.is.OR.some((condition) => {
            if (condition.goalId === null) return task.goalId === null
            return condition.goal.is.status === 'ACTIVE' && decorated.goal?.status === 'ACTIVE'
          })
          if (!eligible) return null
        }
        return { ...schedule, task: decorated }
      }).filter(Boolean)
    },
    async update({ where, data }) {
      const row = rows.find((item) => matches(item, where))
      assert.ok(row)
      Object.assign(row, data)
      return row
    },
    async deleteMany({ where }) {
      const retained = rows.filter((item) => !matches(item, where))
      const count = rows.length - retained.length
      rows.splice(0, rows.length, ...retained)
      if (name === 'tasks' && count) {
        const deletedIds = new Set(database.tasks.filter((item) => matches(item, where)).map((item) => item.id))
        database.schedules = database.schedules.filter((item) => !deletedIds.has(item.taskId))
        database.completions = database.completions.filter((item) => !deletedIds.has(item.taskId))
      }
      return { count }
    },
  }
}

const prisma = {
  dailyTask: {
    ...delegate('tasks'),
    async findFirst({ where, include }) {
      const task = database.tasks.find((item) => matches(item, where))
      return task && include ? taskDetails(task, { goal: true, schedules: true, completions: true }) : task || null
    },
    async update({ where, data }) {
      const task = database.tasks.find((item) => matches(item, where))
      assert.ok(task)
      Object.assign(task, data)
      return task
    },
  },
  taskSchedule: {
    ...delegate('schedules'),
    async findMany({ where, include }) {
      return delegate('schedules').findMany({ where, include })
    },
    async update({ where, data }) {
      return delegate('schedules').update({ where, data })
    },
    async create({ data }) {
      return delegate('schedules').create({ data })
    },
  },
  taskCompletion: {
    ...delegate('completions'),
    async create({ data }) {
      return delegate('completions').create({ data })
    },
  },
  goal: {
    async findFirst({ where }) {
      return database.goals.find((goal) => matches(goal, where)) || null
    },
  },
  async $transaction(callback) {
    return callback(this)
  },
}

function authenticate(request, _response, next) {
  const token = request.cookies?.test_session
  const userId = token === 'user-a' ? userA : token === 'user-b' ? userB : null
  if (!userId) {
    next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.'))
    return
  }
  request.auth = { userId }
  next()
}

function apiRequest(path, token = 'user-a', options = {}) {
  return fetch(`${baseUrl}/api/daily/tasks${path}`, {
    ...options,
    headers: {
      Origin: 'http://127.0.0.1:4173',
      Cookie: `test_session=${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

const personalTask = {
  activity: 'Daily reading',
  description: 'Read one chapter.',
  category: 'Learning',
  priority: 'Normal',
  date: '2026-10-30',
  startTime: '18:00',
  minutes: 30,
  notes: '',
}

before(async () => {
  database.goals.push({
    id: randomUUID(),
    userId: userA,
    title: 'Learn programming',
    category: 'Coding',
    status: 'ACTIVE',
    preferredDays: [5],
    availableMinutes: 60,
    availableStartTime: '17:00',
    availableEndTime: '20:00',
  })
  const app = express()
  app.use(express.json())
  app.use(parseCookies)
  app.use('/api/daily/tasks', createDailyTasksRouter({ prismaProvider: () => prisma, requireAuth: authenticate }))
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

test('daily tasks persist status, schedule revisions, repeated completions, and user ownership', async () => {
  assert.equal((await apiRequest('?from=2026-10-30&to=2026-11-06', 'anonymous')).status, 401)

  const createdResponse = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify(personalTask),
  })
  assert.equal(createdResponse.status, 201)
  const { task: created } = await createdResponse.json()
  assert.equal(created.source, 'personal')

  const start = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'In Progress' }),
  })
  assert.equal((await start.json()).task.status, 'In Progress')
  const complete = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Completed' }),
  })
  assert.equal((await complete.json()).task.completionCount, 1)

  const startRetake = await apiRequest(`/${created.id}/retake`, 'user-a', { method: 'POST' })
  assert.equal((await startRetake.json()).task.status, 'Completed')
  const retakeComplete = await apiRequest(`/${created.id}/retake/complete`, 'user-a', {
    method: 'POST',
    body: JSON.stringify({ notes: 'Second attempt' }),
  })
  const { task: retaken } = await retakeComplete.json()
  assert.equal(retaken.status, 'Completed')
  assert.equal(retaken.completionCount, 2)
  assert.equal(retaken.completionHistory[1].notes, 'Second attempt')

  const lockedStatus = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'In Progress' }),
  })
  assert.equal(lockedStatus.status, 409)

  await apiRequest(`/${created.id}/retake`, 'user-a', { method: 'POST' })
  const third = await apiRequest(`/${created.id}/retake/complete`, 'user-a', {
    method: 'POST',
    body: JSON.stringify({ notes: 'Third attempt' }),
  })
  assert.equal((await third.json()).task.completionCount, 3)

  const reschedule = await apiRequest(`/${created.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify({ date: '2026-10-31', startTime: '19:00' }),
  })
  assert.equal(reschedule.status, 200)
  assert.equal(database.schedules.length, 2)
  assert.equal(database.completions.length, 3)

  const selectedDateTasks = await apiRequest('?from=2026-10-31&to=2026-10-31', 'user-a')
  const list = await selectedDateTasks.json()
  assert.equal(list.tasks.length, 1)
  assert.equal(list.tasks[0].date, '2026-10-31')
  assert.equal(list.tasks[0].completionCount, 3)
  assert.deepEqual((await (await apiRequest('?from=2026-10-30&to=2026-11-06', 'user-b')).json()).tasks, [])

  assert.equal((await apiRequest(`/${created.id}`, 'user-b', {
    method: 'PATCH',
    body: JSON.stringify({ activity: 'Hijack' }),
  })).status, 404)
})

test('daily tasks reject overlaps, invalid availability, and incomplete retake actions', async () => {
  const conflict = await apiRequest('', 'user-a', {
    method: 'POST',
    body: JSON.stringify({ ...personalTask, activity: 'Conflicting task', date: '2026-10-31', startTime: '19:15' }),
  })
  assert.equal(conflict.status, 409)

  const taskId = database.tasks.find((task) => task.userId === userA).id
  assert.equal((await apiRequest(`/${taskId}/retake/complete`, 'user-a', {
    method: 'POST',
    body: JSON.stringify({ notes: '' }),
  })).status, 409)

  const activeGoal = database.goals[0]
  const goalTask = await prisma.dailyTask.create({
    data: {
      userId: userA,
      goalId: activeGoal.id,
      title: 'Goal task',
      category: 'Coding',
      description: '',
      priority: 'NORMAL',
      estimatedMinutes: 30,
      status: 'NOT_STARTED',
      notes: '',
    },
  })
  database.tasks.push(goalTask)
  const invalidWindow = await apiRequest(`/${goalTask.id}`, 'user-a', {
    method: 'PATCH',
    body: JSON.stringify({ date: '2026-10-30', startTime: '16:00' }),
  })
  assert.equal(invalidWindow.status, 400)
})
