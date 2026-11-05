import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import express from 'express'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { createTimetableRouter } from '../src/routes/timetable.routes.js'
import {
  adjustTimetable,
  deleteTimetable,
  generateTimetable,
  getTimetable,
  listTimetables,
  updateTimetable,
} from '../src/services/timetable.service.js'
import { generateTimetableSchema, updateTimetableSchema } from '../src/validation/timetable.validation.js'
import { generateTimetableWithAI } from '../src/services/aiTimetable.service.js'

const userId = randomUUID()

function createPrisma() {
  const records = []
  const prisma = {
    goal: {
      async findMany({ where }) {
        return where.id?.in ? [] : []
      },
    },
    dailyTask: {
      async findMany() { return [] },
    },
    taskSchedule: {
      async findMany() { return [] },
    },
    userPreferences: {
      async findUnique() { return null },
    },
    timetable: {
      async create({ data }) {
        const now = new Date()
        const record = { id: randomUUID().replaceAll('-', '').slice(0, 24), ...data, createdAt: now, updatedAt: now }
        records.push(record)
        return record
      },
      async findMany({ where }) {
        return records.filter((record) => record.userId === where.userId)
      },
      async findFirst({ where }) {
        return records.find((record) => record.id === where.id && record.userId === where.userId) || null
      },
      async update({ where, data }) {
        const record = records.find((item) => item.id === where.id)
        assert.ok(record)
        Object.assign(record, data, { updatedAt: new Date() })
        return record
      },
      async deleteMany({ where }) {
        const index = records.findIndex((item) => item.id === where.id && item.userId === where.userId)
        if (index < 0) return { count: 0 }
        records.splice(index, 1)
        return { count: 1 }
      },
    },
    async $transaction(callback) { return callback(prisma) },
  }
  return prisma
}

function generated(activity, date = '2026-11-04', startTime = '09:00', endTime = '10:00') {
  return {
    date,
    activity,
    startTime,
    endTime,
    minutes: (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3)))
      - (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3))),
    priority: 'High',
    category: 'Study',
    description: 'Focused work.',
  }
}

test('daily generation saves personalized activities and survives list, update, reload, and delete', async () => {
  const prisma = createPrisma()
  const input = generateTimetableSchema.parse({
    range: 'daily',
    startDate: '2026-11-04',
    preferences: {
      wakeTime: '07:00',
      sleepTime: '22:30',
      studyHours: 2,
      style: 'Focused',
    },
  })
  const result = await generateTimetable(input, userId, {
    prisma,
    aiGenerator: async ({ preferences, dates }) => {
      assert.equal(preferences.studyHours, 2)
      assert.deepEqual(dates, ['2026-11-04'])
      return { activities: [generated('Study chapter one')], clarificationQuestions: [], model: 'test-model' }
    },
  })
  assert.equal(result.timetable.durationDays, 1)
  assert.equal(result.timetable.activities[0].activity, 'Study chapter one')
  assert.equal(result.timetable.generationInput.studyHours, 2)

  const listed = await listTimetables(userId, {}, prisma)
  assert.equal(listed.length, 1)
  const timetableId = listed[0].id
  const updatedActivities = listed[0].activities.map((activity) => ({ ...activity, activity: 'Study updated chapter' }))
  const updated = await updateTimetable(timetableId, userId, updatedActivities, prisma)
  assert.equal(updated.activities[0].activity, 'Study updated chapter')
  assert.equal((await getTimetable(timetableId, userId, prisma)).activities[0].activity, 'Study updated chapter')
  await deleteTimetable(timetableId, userId, prisma)
  assert.equal((await listTimetables(userId, {}, prisma)).length, 0)
})

test('weekly generation repeats fixed commitments, keeps entries in range, and rejects overlaps', async () => {
  const prisma = createPrisma()
  let busyBlocks
  const result = await generateTimetable({
    range: 'weekly',
    startDate: '2026-11-02',
    preferences: {
      fixedCommitments: [{ activity: 'Prayer', startTime: '12:00', endTime: '12:15', category: 'Commitment', description: '' }],
    },
  }, userId, {
    prisma,
    aiGenerator: async (input) => {
      busyBlocks = input.busyBlocks
      return {
        activities: [generated('Study', '2026-11-02', '13:00', '14:00')],
        clarificationQuestions: [],
        model: 'test-model',
      }
    },
  })
  assert.equal(result.timetable.durationDays, 7)
  assert.equal(busyBlocks.length, 7)
  assert.equal(result.timetable.activities.length, 8)
  assert.ok(result.timetable.activities.every((activity) => activity.date >= '2026-11-02' && activity.date <= '2026-11-08'))

  const overlapping = result.timetable.activities.map((activity) => ({
    ...activity,
    ...(activity.activity === 'Study' ? { startTime: '12:10', endTime: '13:10', minutes: 60 } : {}),
  }))
  await assert.rejects(
    updateTimetable(result.timetable.id, userId, overlapping, prisma),
    (error) => error.code === 'TIMETABLE_OVERLAP',
  )
})

test('natural-language adjustments preserve completed activities and persist the adjusted plan', async () => {
  const prisma = createPrisma()
  const created = await generateTimetable({
    range: 'daily',
    startDate: '2026-11-04',
    preferences: {},
  }, userId, {
    prisma,
    aiGenerator: async () => ({
      activities: [
        generated('Completed reading', '2026-11-04', '08:00', '09:00'),
        generated('Coding', '2026-11-04', '09:00', '10:00'),
      ],
      clarificationQuestions: [],
      model: 'test-model',
    }),
  })
  const activities = created.timetable.activities.map((activity) => activity.activity === 'Completed reading'
    ? { ...activity, status: 'Completed' }
    : activity)
  await updateTimetable(created.timetable.id, userId, activities, prisma)

  const adjusted = await adjustTimetable(created.timetable.id, userId, 'Move coding to the evening.', {
    prisma,
    aiAdjuster: async ({ activities: current }) => ({
      activities: [
        { ...generated('Completed reading', '2026-11-04', '07:00', '08:00'), status: 'Completed' },
        generated('Coding', '2026-11-04', '18:00', '19:00'),
      ],
      clarificationQuestions: [],
      model: 'test-model',
      originalCount: current.length,
    }),
  })
  const completed = adjusted.timetable.activities.find((item) => item.activity === 'Completed reading')
  assert.equal(completed.status, 'Completed')
  assert.equal(completed.startTime, '08:00')
  assert.equal(adjusted.timetable.activities.find((item) => item.activity === 'Coding').startTime, '18:00')
})

test('generation asks for clarification instead of saving when the AI identifies missing essential details', async () => {
  const result = await generateTimetable({
    range: 'daily',
    startDate: '2026-11-04',
    preferences: {},
  }, userId, {
    prisma: createPrisma(),
    aiGenerator: async () => ({
      activities: [],
      clarificationQuestions: ['What hours are unavailable for work or school?'],
    }),
  })
  assert.deepEqual(result, { clarificationQuestions: ['What hours are unavailable for work or school?'] })
})

test('validation accepts optional inputs and rejects malformed or overlapping-duration fields', () => {
  assert.equal(generateTimetableSchema.safeParse({ range: 'daily', startDate: '2026-11-04' }).success, true)
  assert.equal(generateTimetableSchema.safeParse({
    range: 'daily',
    startDate: '2026-11-04',
    preferences: { wakeTime: '', sleepTime: '' },
  }).success, true)
  assert.equal(generateTimetableSchema.safeParse({
    range: 'daily',
    startDate: '2026-11-04',
    preferences: { sleepTime: '25:30' },
  }).success, false)
  assert.equal(updateTimetableSchema.safeParse({
    activities: [{
      id: randomUUID(),
      date: '2026-11-04',
      activity: 'Invalid duration',
      startTime: '09:00',
      endTime: '10:00',
      minutes: 45,
      priority: 'Normal',
      category: 'Study',
      status: 'Planned',
    }],
  }).success, false)
})

test('authenticated timetable API generates, retrieves, updates, isolates, and deletes records', async () => {
  const prisma = createPrisma()
  const app = express()
  app.use(express.json())
  app.use('/api/timetable', createTimetableRouter({
    prismaProvider: () => prisma,
    limiterEnabled: false,
    aiGenerator: async () => ({
      activities: [generated('API study session')],
      clarificationQuestions: [],
      model: 'test-model',
    }),
    requireAuth: (request, response, next) => {
      const owner = request.get('x-user')
      if (!owner) {
        response.status(401).json({ error: { code: 'AUTH_REQUIRED' } })
        return
      }
      request.auth = { userId: owner }
      next()
    },
  }))
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/timetable`
  const headers = { Origin: 'http://127.0.0.1:4173', 'x-user': userId, 'Content-Type': 'application/json' }
  try {
    const denied = await fetch(baseUrl)
    assert.equal(denied.status, 401)

    const generatedResponse = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ range: 'daily', startDate: '2026-11-04', preferences: {} }),
    })
    assert.equal(generatedResponse.status, 201)
    const created = (await generatedResponse.json()).timetable

    const owned = await fetch(`${baseUrl}/${created.id}`, { headers })
    assert.equal(owned.status, 200)
    const otherOwner = await fetch(`${baseUrl}/${created.id}`, { headers: { ...headers, 'x-user': randomUUID() } })
    assert.equal(otherOwner.status, 404)

    const changed = created.activities.map((activity) => ({ ...activity, activity: 'API-updated study session' }))
    const updated = await fetch(`${baseUrl}/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ activities: changed }),
    })
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).timetable.activities[0].activity, 'API-updated study session')

    const deleted = await fetch(`${baseUrl}/${created.id}`, { method: 'DELETE', headers })
    assert.equal(deleted.status, 204)
    const missing = await fetch(`${baseUrl}/${created.id}`, { headers })
    assert.equal(missing.status, 404)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('OpenAI integration reports an explicit configuration error without an API key', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    await assert.rejects(
      generateTimetableWithAI({ range: 'daily' }),
      (error) => error.statusCode === 503 && error.code === 'AI_NOT_CONFIGURED',
    )
  } finally {
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey
  }
})
