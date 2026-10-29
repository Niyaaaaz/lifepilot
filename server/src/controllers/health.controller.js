import { getHealthStatus } from '../services/health.service.js'

export function healthController(_request, response) {
  response.status(200).json(getHealthStatus())
}
