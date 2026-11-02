import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { disconnectDatabase, getPrismaClient } from '../src/config/database.js'
import { getGoalProgress } from '../src/services/goals.service.js'

let prisma

after(async () => {
  await disconnectDatabase()
})

test('MongoDB connects and persists owned LifePilot data with CRUD operations', async () => {
  assert.ok(
    process.env.DATABASE_URL,
    'Set DATABASE_URL in backend/.env to a MongoDB database before running npm run db:test.',
  )

  prisma = getPrismaClient()
  await prisma.$connect()
  await prisma.$runCommandRaw({ ping: 1 })

  const email = `db-test-${randomUUID()}@example.invalid`
  let user
  let goal
  let task

  try {
    user = await prisma.user.create({
      data: {
        email,
        displayName: 'Database integration test',
        preferences: { create: { timezone: 'UTC' } },
      },
    })
    goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Integration test goal',
        durationAmount: 4,
        durationUnit: 'WEEKS',
        milestones: { create: [{ title: 'First milestone' }] },
        weeklyObjectives: {
          create: [{ title: 'First weekly objective', weekNumber: 1 }],
        },
      },
      include: { milestones: true, weeklyObjectives: true },
    })
    assert.equal(goal.milestones.length, 1)
    assert.equal(goal.weeklyObjectives.length, 1)

    const updatedGoal = await prisma.goal.update({
      where: { id: goal.id },
      data: { description: 'Updated by an integration test.' },
    })
    assert.equal(updatedGoal.description, 'Updated by an integration test.')

    task = await prisma.dailyTask.create({
      data: {
        userId: user.id,
        goalId: goal.id,
        weeklyObjectiveId: goal.weeklyObjectives[0].id,
        title: 'One task definition with multiple attempts',
        estimatedMinutes: 30,
        status: 'COMPLETED',
        isGoalRepetition: true,
        completedAt: new Date(),
        completions: {
          create: [
            { notes: 'First attempt' },
            { notes: 'Retake attempt' },
          ],
        },
        schedules: {
          create: {
            scheduledDate: new Date('2026-10-30T00:00:00.000Z'),
            status: 'COMPLETED',
          },
        },
      },
      include: { completions: true, schedules: true },
    })

    assert.equal(task.completions.length, 2)
    assert.equal(task.schedules.length, 1)
    assert.equal((await prisma.dailyTask.count({ where: { goalId: goal.id, userId: user.id } })), 1)

    const progress = await getGoalProgress(goal.id, user.id)
    assert.deepEqual(progress, { totalTasks: 1, completedTasks: 1, percentage: 100, repetitionCount: 2 })

    const preference = await prisma.userPreferences.findUnique({ where: { userId: user.id } })
    assert.equal(preference.timezone, 'UTC')

    const deletedGoal = await prisma.goal.delete({ where: { id: goal.id } })
    assert.equal(deletedGoal.id, goal.id)
    assert.equal(await prisma.goal.findUnique({ where: { id: goal.id } }), null)
    assert.equal(await prisma.dailyTask.findUnique({ where: { id: task.id } }), null)
    assert.equal(await prisma.taskCompletion.count({ where: { taskId: task.id } }), 0)
  } finally {
    if (task && user) await prisma.dailyTask.deleteMany({ where: { id: task.id, userId: user.id } })
    if (goal && user) await prisma.goal.deleteMany({ where: { id: goal.id, userId: user.id } })
    if (user) await prisma.user.deleteMany({ where: { id: user.id } })
  }
})
