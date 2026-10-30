import { z } from 'zod'

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Use a valid calendar date.')

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)

export const dailyTasksQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
}).strict().refine(({ from, to }) => from <= to, {
  path: ['to'],
  message: 'The end date must be on or after the start date.',
})

export const dailyTaskIdParamsSchema = z.object({
  taskId: z.string().uuid('Task ID must be a UUID.'),
}).strict()

const taskFields = {
  activity: z.string().trim().min(1).max(180),
  description: z.string().max(10000).default(''),
  category: z.string().max(80).optional().default('Personal'),
  priority: z.enum(['High', 'Normal', 'Low']).default('Normal'),
  date: dateSchema,
  startTime: timeSchema,
  minutes: z.coerce.number().int().min(1).max(1440),
  notes: z.string().max(4000).optional().default(''),
}

export const createPersonalTaskSchema = z.object(taskFields).strict()
export const updateTaskSchema = z.object({
  activity: taskFields.activity.optional(),
  description: taskFields.description.optional(),
  category: taskFields.category.optional(),
  priority: taskFields.priority.optional(),
  date: taskFields.date.optional(),
  startTime: taskFields.startTime.optional(),
  minutes: taskFields.minutes.optional(),
  notes: taskFields.notes.optional(),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one task field to update.',
})

export const completeRetakeSchema = z.object({
  notes: z.string().max(500).optional().default(''),
}).strict()
