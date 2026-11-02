import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { after, before, test } from 'node:test'
import { createGamesRouter } from '../src/routes/games.routes.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

const userA = randomUUID()
const userB = randomUUID()
const games = []
const preferences = []
let server
let baseUrl

function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'userId_gameKey') return record.userId === value.userId && record.gameKey === value.gameKey
    return record[key] === value
  })
}

const prisma = {
  brainTrainingGame: {
    async findMany({ where }) {
      return games.filter((game) => matches(game, where))
    },
    async findFirst({ where }) {
      return games.find((game) => matches(game, where)) || null
    },
    async create({ data }) {
      if (games.some((game) => game.userId === data.userId && game.gameUrl === data.gameUrl)) {
        const error = new Error('Unique constraint')
        error.code = 'P2002'
        throw error
      }
      const now = new Date()
      const game = { id: randomUUID().replaceAll('-', '').slice(0, 24), ...data, icon: data.icon || null, createdAt: now, updatedAt: now }
      games.push(game)
      return game
    },
    async update({ where, data }) {
      const game = games.find((item) => matches(item, where))
      assert.ok(game)
      Object.assign(game, data, { updatedAt: new Date() })
      return game
    },
    async deleteMany({ where }) {
      const count = games.filter((game) => matches(game, where)).length
      for (let index = games.length - 1; index >= 0; index--) {
        if (matches(games[index], where)) games.splice(index, 1)
      }
      return { count }
    },
  },
  userGamePreference: {
    async findMany({ where }) {
      return preferences.filter((preference) => matches(preference, where))
    },
    async findUnique({ where }) {
      return preferences.find((preference) => matches(preference, where)) || null
    },
    async create({ data }) {
      const preference = { id: randomUUID(), lastPlayedAt: null, ...data }
      preferences.push(preference)
      return preference
    },
    async update({ where, data }) {
      const preference = preferences.find((item) => matches(item, where))
      assert.ok(preference)
      Object.assign(preference, data)
      return preference
    },
    async deleteMany({ where }) {
      const count = preferences.filter((preference) => matches(preference, where)).length
      for (let index = preferences.length - 1; index >= 0; index--) {
        if (matches(preferences[index], where)) preferences.splice(index, 1)
      }
      return { count }
    },
  },
}

function request(path, { userId = userA, ...options } = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: 'http://127.0.0.1:4173',
      'x-test-user': userId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

before(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/games', createGamesRouter({
    prismaProvider: () => prisma,
    requireAuth: (request, _response, next) => {
      request.auth = { userId: request.get('x-test-user') || userA }
      next()
    },
  }))
  app.use(errorHandler)
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

test('game library creates owned games with generated Google links and persists preferences', async () => {
  const createdResponse = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Chess & Strategy',
      description: 'A custom game entry.',
      category: 'Strategy Games',
    }),
  })
  const createdBody = await createdResponse.json()
  assert.equal(createdResponse.status, 201)
  assert.equal(createdBody.game.searchUrl, 'https://www.google.com/search?q=play+Chess+%26+Strategy+online')
  const gameId = createdBody.game.id
  const key = `custom-${gameId}`

  const favoriteResponse = await request(`/api/games/preferences/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite: true }),
  })
  assert.equal(favoriteResponse.status, 200)
  assert.equal((await favoriteResponse.json()).preference.isFavorite, true)

  const recentResponse = await request(`/api/games/preferences/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ played: true }),
  })
  assert.ok((await recentResponse.json()).preference.lastPlayedAt)

  const listResponse = await request('/api/games')
  const listed = await listResponse.json()
  assert.equal(listed.games.length, 1)
  assert.equal(listed.preferences[0].gameKey, key)
  assert.equal(listed.preferences[0].isFavorite, true)

  const otherUserResponse = await request(`/api/games/preferences/${key}`, {
    userId: userB,
    method: 'PATCH',
    body: JSON.stringify({ isFavorite: true }),
  })
  assert.equal(otherUserResponse.status, 404)

  const updatedResponse = await request(`/api/games/${gameId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Updated Chess', category: 'Chess', description: '', thumbnailUrl: '', icon: '♟️' }),
  })
  assert.equal(updatedResponse.status, 200)
  assert.equal((await updatedResponse.json()).game.searchUrl, 'https://www.google.com/search?q=play+Updated+Chess+online')

  const deletedResponse = await request(`/api/games/${gameId}`, { method: 'DELETE' })
  assert.equal(deletedResponse.status, 204)
  assert.equal((await request('/api/games')).status, 200)
})

test('game library rejects unsupported categories and non-image data URLs', async () => {
  const invalidCategory = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad category', category: 'Unknown', description: '', thumbnailUrl: '' }),
  })
  assert.equal(invalidCategory.status, 400)

  const invalidImage = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad image', category: 'Arcade Games', description: '', thumbnailUrl: 'data:text/html;base64,abc' }),
  })
  assert.equal(invalidImage.status, 400)
})
