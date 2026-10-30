import { getDatabaseHealth } from '../services/databaseHealth.service.js'

export async function databaseHealthController(_request, response) {
  response.status(200).json(await getDatabaseHealth())
}
