import { z } from 'zod'

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Use a valid calendar date.')

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const optionalTimeSchema = z.union([timeSchema, z.literal('')]).optional().default('')
const prioritySchema = z.enum(['High', 'Normal', 'Low']).default('Normal')
const categorySchema = z.string().trim().min(1).max(80)
const recordIdSchema = z.string().refine(
  (value) => /^[0-9a-f]{24}$/i.test(value) || z.string().uuid().safeParse(value).success,
  'ID must be a MongoDB ObjectId or UUID.',
)

const commitmentSchema = z.object({
  activity: z.string().trim().min(1).max(180),
  startTime: timeSchema,
  endTime: timeSchema,
  category: categorySchema.default('Personal'),
  description: z.string().max(2000).default(''),
}).strict().refine(({ startTime, endTime }) => startTime < endTime, {
  path: ['endTime'],
  message: 'End time must be after start time.',
})

const customActivitySchema = z.object({
  activity: z.string().trim().min(1).max(180),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  minutes: z.coerce.number().int().min(5).max(1440).optional(),
  category: categorySchema.default('Personal'),
  description: z.string().max(2000).default(''),
  priority: prioritySchema,
}).strict().refine(({ startTime, endTime }) => Boolean(startTime) === Boolean(endTime), {
  message: 'Provide both start and end time, or leave both blank for a flexible activity.',
}).refine(({ startTime, endTime }) => !startTime || startTime < endTime, {
  path: ['endTime'],
  message: 'End time must be after start time.',
}).refine(({ minutes, startTime, endTime }) => !startTime || !minutes
  || timeMinutes(endTime) - timeMinutes(startTime) === minutes, {
  path: ['minutes'],
  message: 'Duration must match the selected start and end times.',
})

function timeMinutes(value) {
  if (!value) return 0
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

const preferencesSchema = z.object({
  wakeTime: optionalTimeSchema,
  sleepTime: optionalTimeSchema,
  collegeWork: z.array(commitmentSchema).max(20).default([]),
  fitness: z.array(commitmentSchema).max(20).default([]),
  fixedCommitments: z.array(commitmentSchema).max(100).default([]),
  mealTimes: z.array(commitmentSchema).max(20).default([]),
  studyHours: z.coerce.number().min(0).max(16).optional(),
  codingHours: z.coerce.number().min(0).max(16).optional(),
  businessHours: z.coerce.number().min(0).max(16).optional(),
  personalHours: z.coerce.number().min(0).max(16).optional(),
  breakDuration: z.coerce.number().int().min(5).max(90).optional().default(15),
  availableFreeTime: z.string().max(3000).optional().default(''),
  dailyGoals: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  priorityTasks: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  style: z.enum(['Balanced', 'Focused', 'Flexible', 'Light']).default('Balanced'),
  customActivities: z.array(customActivitySchema).default([]),
}).strict()

export const generateTimetableSchema = z.object({
  range: z.enum(['daily', 'weekly']),
  startDate: dateSchema,
  preferences: preferencesSchema.default({}),
}).strict()

export const timetableQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  range: z.enum(['daily', 'weekly']).optional(),
}).strict().refine(({ from, to }) => !from || !to || from <= to, {
  path: ['to'],
  message: 'The end date must be on or after the start date.',
})

const activitySchema = z.object({
  id: z.string().uuid(),
  date: dateSchema,
  activity: z.string().trim().min(1).max(180),
  startTime: timeSchema,
  endTime: timeSchema,
  minutes: z.coerce.number().int().min(1).max(1440),
  priority: z.enum(['High', 'Normal', 'Low']),
  category: categorySchema,
  description: z.string().max(2000).default(''),
  relatedGoalId: recordIdSchema.optional().nullable(),
  dailyTaskId: recordIdSchema.optional().nullable(),
  status: z.enum(['Planned', 'Completed', 'Skipped']).default('Planned'),
  fixed: z.boolean().default(false),
}).strict().refine(({ startTime, endTime, minutes }) => (
  timeMinutes(endTime) > timeMinutes(startTime)
  && timeMinutes(endTime) - timeMinutes(startTime) === minutes
), {
  path: ['endTime'],
  message: 'Activity duration must exactly match its start and end times.',
})

export const updateTimetableSchema = z.object({
  activities: z.array(activitySchema).max(1000),
}).strict()

export const adjustTimetableSchema = z.object({
  instruction: z.string().trim().min(3).max(1500),
}).strict()

export const timetableIdParamsSchema = z.object({
  id: recordIdSchema,
}).strict()

export const timetableActivityParamsSchema = z.object({
  id: recordIdSchema,
  activityId: z.string().uuid(),
}).strict()

export const timetableActivityStatusSchema = z.object({
  status: z.enum(['Completed', 'Skipped', 'Planned']),
}).strict()

export const timetableActivitySchema = activitySchema
