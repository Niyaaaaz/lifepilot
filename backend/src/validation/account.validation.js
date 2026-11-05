import { z } from 'zod'

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const timezoneSchema = z.string().trim().min(1).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}, 'Use a valid IANA time zone.')
const webUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}, 'Use a safe HTTP or HTTPS URL.')

const profileDetailsSchema = z.object({
  username: z.string().max(60).optional(),
  phone: z.string().max(40).optional(),
  dob: z.string().max(20).optional(),
  gender: z.string().max(60).optional(),
  location: z.string().max(120).optional(),
  bio: z.string().max(1000).optional(),
}).strict()

const instructorSettingsSchema = z.object({
  suggestBreaks: z.boolean(),
  moveUnfinishedTasks: z.boolean(),
  askFollowUpQuestions: z.boolean(),
  dailyMotivation: z.boolean(),
}).strict()

const notificationSettingsSchema = z.object({
  scheduleReminders: z.boolean(),
  taskDeadlineReminders: z.boolean(),
  goalProgressReminders: z.boolean(),
  eveningReviewReminders: z.boolean(),
  weeklySummary: z.boolean(),
  emailNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
}).strict()

const privacySettingsSchema = z.object({
  profileVisibility: z.boolean(),
  aiPersonalization: z.boolean(),
}).strict()

const preferenceSettingsSchema = z.object({
  wake: timeSchema.optional(),
  sleep: timeSchema.optional(),
  productivity: z.enum(['1 priority task', '3 priority tasks', '5 priority tasks']).optional(),
  energy: z.enum(['Low', 'Medium', 'High']).optional(),
  focus: z.string().max(120).optional(),
  language: z.enum(['English', 'Hindi']).optional(),
  selectedAreas: z.array(z.string().max(120)).max(30).optional(),
  instructorStyle: z.enum(['Friendly', 'Motivational', 'Direct', 'Calm', 'Detailed', 'Short and simple']).optional(),
  instructor: instructorSettingsSchema.optional(),
  notifications: notificationSettingsSchema.optional(),
  privacy: privacySettingsSchema.optional(),
  profileDetails: profileDetailsSchema.optional(),
}).strict()

export const accountEmptyQuerySchema = z.object({}).strict()

export const userProfileBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  profileImage: webUrlSchema.nullable().optional(),
  profileDetails: profileDetailsSchema.optional(),
}).strict()

export const preferencesBodySchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notificationsEnabled: z.boolean().optional(),
  preferredLanguage: z.enum(['English', 'Hindi']).optional(),
  dailyStudyHours: z.coerce.number().min(0).max(24).optional(),
  timezone: timezoneSchema.optional(),
  wakeTime: timeSchema.optional(),
  sleepTime: timeSchema.optional(),
  settings: preferenceSettingsSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required.')

export const dashboardEmptyQuerySchema = z.object({}).strict()

const recordIdSchema = z.string().refine(
  (value) => /^[0-9a-f]{24}$/i.test(value) || z.string().uuid().safeParse(value).success,
  'ID must be a MongoDB ObjectId or UUID.',
)

export const goalMilestoneParamsSchema = z.object({ goalId: recordIdSchema }).strict()
export const milestoneParamsSchema = z.object({ milestoneId: recordIdSchema }).strict()

const milestoneFields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().max(10000).optional().default(''),
  dueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`)
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    }, 'Use a valid YYYY-MM-DD date.')
    .nullable()
    .optional(),
  status: z.enum(['pending', 'completed']).optional(),
}

export const createMilestoneBodySchema = z.object({
  ...milestoneFields,
  title: milestoneFields.title,
}).strict()

export const updateMilestoneBodySchema = z.object(milestoneFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one milestone field is required.')
