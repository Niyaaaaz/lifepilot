import { HttpError } from './httpError.js'

export function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    })
    return
  }

  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body must contain valid JSON.' } })
    return
  }

  if (error?.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' } })
    return
  }

  console.error('Unhandled API error:', error)
  response.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' } })
}
