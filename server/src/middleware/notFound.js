import { HttpError } from './httpError.js'

export function notFound(_request, _response, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested API route was not found.'))
}
