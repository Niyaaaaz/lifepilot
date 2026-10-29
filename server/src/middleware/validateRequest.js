import { ZodError } from 'zod'
import { HttpError } from './httpError.js'

export function validateRequest(schemas) {
  return async (request, _response, next) => {
    try {
      const validated = {}
      for (const [part, schema] of Object.entries(schemas)) {
        validated[part] = await schema.parseAsync(request[part])
      }
      request.validated = validated
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(
          400,
          'VALIDATION_ERROR',
          'Request validation failed.',
          error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ))
        return
      }
      next(error)
    }
  }
}
