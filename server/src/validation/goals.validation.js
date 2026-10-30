import { z } from 'zod'

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid YYYY-MM-DD date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Use a valid calendar date.')

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const statusSchema = z.enum(['Not Started', 'In Progress', 'Completed'])

const completionSchema = z.object({
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(4000).optional().default(''),
}).strict()

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  scheduleKey: z.string().max(120).optional(),
  sourceKey: z.string().max(120).optional(),
  title: z.string().trim().min(1).max(180),
  detail: z.string().max(10000).optional().default(''),
  priority: z.enum(['High', 'Normal', 'Low']).default('Normal'),
  minutes: z.coerce.number().int().min(1).max(1440),
  status: statusSchema.default('Not Started'),
  completed: z.boolean().optional(),
  completedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(4000).optional().default(''),
  scheduledDate: dateSchema.nullable().optional(),
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  isGoalRepetition: z.boolean().default(false),
  completionHistory: z.array(completionSchema).max(1000).optional().default([]),
}).strict()

const phaseSchema = z.object({
  id: z.string().uuid().optional(),
  weekNumber: z.coerce.number().int().min(1).max(1000),
  monthNumber: z.coerce.number().int().min(1).max(1000),
  monthKey: z.string().max(80).optional(),
  monthLabel: z.string().max(160).optional(),
  name: z.string().trim().min(1).max(160),
  objective: z.string().max(10000).optional().default(''),
  completionCriteria: z.string().max(10000).optional().default(''),
  startDate: dateSchema.nullable().optional(),
  endDate: dateSchema.nullable().optional(),
  tasks: z.array(taskSchema).max(1000),
}).strict()

const milestoneSchema = z.object({
  id: z.string().uuid().optional(),
  monthKey: z.string().max(80).optional(),
  title: z.string().trim().min(1).max(160),
  outcome: z.string().max(10000).optional().default(''),
  date: dateSchema.nullable().optional(),
}).strict()

export const goalIdParamsSchema = z.object({
  goalId: z.string().uuid('Goal ID must be a UUID.'),
}).strict()

export const goalsEmptyQuerySchema = z.object({}).strict()

export const goalBodySchema = z.object({
  legacyId: z.string().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10000).default(''),
  current: z.string().max(10000).default(''),
  outcome: z.string().max(10000).default(''),
  durationAmount: z.coerce.number().positive().max(10000),
  durationUnit: z.enum(['days', 'weeks', 'months', 'years']),
  durationDays: z.coerce.number().int().positive().max(365250),
  startDate: dateSchema,
  targetDate: dateSchema.nullable().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).default('active'),
  category: z.string().max(80).optional().default(''),
  hoursPerDay: z.coerce.number().nonnegative().max(24).default(0),
  preferredDays: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
  availableStartTime: timeSchema.nullable().optional(),
  availableEndTime: timeSchema.nullable().optional(),
  skills: z.string().max(10000).optional().default(''),
  resources: z.string().max(10000).optional().default(''),
  limitations: z.string().max(10000).optional().default(''),
  style: z.string().max(10000).optional().default(''),
  budget: z.string().max(10000).optional().default(''),
  instructions: z.string().max(10000).optional().default(''),
  resourceGuidance: z.string().max(10000).optional().default(''),
  challengeGuidance: z.string().max(10000).optional().default(''),
  estimatedHours: z.coerce.number().nonnegative().max(100000).optional().default(0),
  daysNeeded: z.coerce.number().int().nonnegative().max(365250).optional().default(0),
  phases: z.array(phaseSchema).max(1000),
  milestones: z.array(milestoneSchema).max(1000).optional().default([]),
}).strict()
