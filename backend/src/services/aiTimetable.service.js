import { z } from 'zod'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/httpError.js'

const aiActivitySchema = z.object({
  id: z.string().max(64).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().trim().min(1).max(180),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  minutes: z.number().int().positive(),
  priority: z.enum(['High', 'Normal', 'Low']),
  category: z.string().trim().min(1).max(80),
  description: z.string().max(2000).default(''),
  relatedGoalId: z.string().nullable().optional(),
  dailyTaskId: z.string().nullable().optional(),
  status: z.enum(['Planned', 'Completed', 'Skipped']).optional(),
})

const aiResultSchema = z.object({
  activities: z.array(aiActivitySchema).max(500).default([]),
  clarificationQuestions: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
}).strict()

function extractText(response) {
  if (typeof response.output_text === 'string') return response.output_text
  const chunks = (response.output || []).flatMap((item) => item.content || [])
  return chunks.filter((item) => item.type === 'output_text').map((item) => item.text).join('\n')
}

async function requestJson({ input, instruction }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new HttpError(
      503,
      'AI_NOT_CONFIGURED',
      'AI timetable generation is unavailable. Configure OPENAI_API_KEY in backend/.env and restart the backend.',
    )
  }

  let response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        store: false,
        instructions: instruction,
        input: JSON.stringify(input),
        text: { format: { type: 'json_object' } },
      }),
    })
  } catch (error) {
    throw new HttpError(502, 'AI_PROVIDER_UNAVAILABLE', `The AI provider could not be reached: ${error.message}`)
  }

  if (!response.ok) {
    const status = response.status
    const code = status === 401 ? 'AI_PROVIDER_AUTH_FAILED' : 'AI_PROVIDER_REQUEST_FAILED'
    const message = status === 401
      ? 'The configured OpenAI API key was rejected. Check OPENAI_API_KEY in backend/.env.'
      : `OpenAI could not complete the timetable request (HTTP ${status}).`
    throw new HttpError(status === 429 ? 429 : 502, code, message)
  }

  const payload = await response.json()
  const text = extractText(payload)
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new HttpError(502, 'AI_INVALID_RESPONSE', 'The AI provider returned an unreadable timetable. Please try again.')
  }
  const result = aiResultSchema.safeParse(parsed)
  if (!result.success) {
    throw new HttpError(502, 'AI_INVALID_RESPONSE', 'The AI provider returned an invalid timetable structure. Please try again.')
  }
  return { ...result.data, model: env.OPENAI_MODEL }
}

const timetableInstruction = `You are LifePilot's timetable planner. Return only JSON with this shape:
{"activities":[{"date":"YYYY-MM-DD","activity":"...","startTime":"HH:MM","endTime":"HH:MM","minutes":30,"priority":"High|Normal|Low","category":"...","description":"...","relatedGoalId":null,"dailyTaskId":null}],"clarificationQuestions":[]}.
Create a realistic schedule using only the supplied dates and waking hours. Respect every busy block; never overlap activities; include reasonable breaks and meals when requested; do not schedule during sleep or unavailable time. Give high-priority existing tasks precedence, meet requested study/coding/business/personal hours only when feasible, and reduce workload rather than overpack the day. Use the supplied task IDs only for the corresponding pending Daily Instructor task and goal IDs only for supplied goals. Do not duplicate busy blocks or tasks already scheduled. If an essential ambiguity prevents a safe useful timetable, return no activities and ask concise clarificationQuestions instead of guessing. Do not claim that a task or commitment is complete.`

export async function generateTimetableWithAI(input) {
  return requestJson({ input, instruction: timetableInstruction })
}

const adjustmentInstruction = `You are adjusting an existing LifePilot timetable. Return only JSON with the same shape:
{"activities":[{"id":"copy-the-id-for-an-existing-activity","date":"YYYY-MM-DD","activity":"...","startTime":"HH:MM","endTime":"HH:MM","minutes":30,"priority":"High|Normal|Low","category":"...","description":"...","relatedGoalId":null,"dailyTaskId":null,"status":"Planned|Completed|Skipped"}],"clarificationQuestions":[]}.
Apply the user's instruction while avoiding conflicts and respecting sleep, fixed commitments, date range, and reasonable breaks. Preserve every activity marked Completed exactly, including its id, date, time, duration, name and status. Retain unaffected activities and their IDs. Keep existing dailyTaskId and relatedGoalId links when an activity remains the same. Return a clarification question instead of making a material guess when necessary.`

export async function adjustTimetableWithAI(input) {
  return requestJson({ input, instruction: adjustmentInstruction })
}
