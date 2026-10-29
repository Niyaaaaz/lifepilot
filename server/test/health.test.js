import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/app.js'

let server
let baseUrl

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('health endpoint reports API status', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'lifepilot-api')
  assert.equal(typeof body.timestamp, 'string')
  assert.equal(typeof body.uptimeSeconds, 'number')
})

test('health endpoint rejects unexpected query parameters', async () => {
  const response = await fetch(`${baseUrl}/api/health?unexpected=true`)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
})

test('unknown API routes return a structured not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`)
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(body.error.code, 'NOT_FOUND')
})

test('CORS allows configured frontend origins and rejects others', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://127.0.0.1:4173' },
  })
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4173')

  const denied = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://unapproved.example' },
  })
  const body = await denied.json()
  assert.equal(denied.status, 403)
  assert.equal(body.error.code, 'CORS_ORIGIN_DENIED')
})
