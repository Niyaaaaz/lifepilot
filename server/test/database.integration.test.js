import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { disconnectDatabase, getPrismaClient } from '../src/config/database.js'
import { getGoalProgress } from '../src/services/goals.service.js'

let prisma

after(async () => {
  await disconnectDatabase()
})

test('PostgreSQL connects and persists owned LifePilot data with CRUD operations', async () => {
  assert.ok(
    process.env.DATABASE_URL,
    'Set DATABASE_URL in server/.env to a disposable PostgreSQL database before running npm run db:test.',
  )

  prisma = getPrismaClient()
  await prisma.$connect()
  await prisma.$queryRaw`SELECT 1`

  const email = `db-test-${crypto.randomUUID()}@example.invalid`
  let user

  try {
    user = await prisma.user.create({
      data: {
        email,
        displayName: 'Database integration test',
        preferences: { create: { timezone: 'UTC' } },
      },
    })
    context.after(async () => {
      await prisma.user.deleteMany({ where: { id: user.id } })
    })

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: 'Integration test goal',
        durationAmount: 4,
        durationUnit: 'WEEKS',
        milestones: { create: [{ userId: user.id, title: 'First milestone' }] },
        weeklyObjectives: {
          create: [{ userId: user.id, title: 'First weekly objective', weekNumber: 1 }],
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

    const task = await prisma.dailyTask.create({
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
            { userId: user.id, notes: 'First attempt' },
            { userId: user.id, notes: 'Retake attempt' },
          ],
        },
        schedules: {
          create: {
            userId: user.id,
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
    if (user) await prisma.user.deleteMany({ where: { id: user.id } })
  }
})
