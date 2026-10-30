import { z } from 'zod'

const emailSchema = z.string()
  .trim()
  .email('Enter a valid email address.')
  .max(320, 'Email address is too long.')
  .transform((email) => email.toLowerCase())

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be no more than 128 characters.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/\d/, 'Password must include at least one number.')

export const signupBodySchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120, 'Name must be 120 characters or fewer.'),
  email: emailSchema,
  password: passwordSchema,
}).strict()

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(128, 'Password is too long.'),
  rememberMe: z.boolean().default(false),
}).strict()

export const authEmptyQuerySchema = z.object({}).strict()
