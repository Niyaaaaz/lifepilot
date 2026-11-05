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
  app.use('/api/gaming', createGamesRouter({
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

test('gaming API saves direct game websites and persists preferences', async () => {
  const createdResponse = await request('/api/gaming', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Chess & Strategy',
      gameUrl: 'https://www.chess.com/',
      description: 'A custom game entry.',
      category: 'Chess and Strategy',
    }),
  })
  const createdBody = await createdResponse.json()
  assert.equal(createdResponse.status, 201)
  assert.equal(createdBody.game.gameUrl, 'https://www.chess.com/')
  assert.equal(createdBody.game.searchUrl, undefined)
  const gameId = createdBody.game.id
  const key = `custom-${gameId}`

  const favoriteResponse = await request(`/api/gaming/preferences/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite: true }),
  })
  assert.equal(favoriteResponse.status, 200)
  assert.equal((await favoriteResponse.json()).preference.isFavorite, true)

  const recentResponse = await request(`/api/gaming/preferences/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ played: true }),
  })
  assert.ok((await recentResponse.json()).preference.lastPlayedAt)

  const listResponse = await request('/api/gaming')
  const listed = await listResponse.json()
  assert.equal(listed.games.length, 1)
  assert.equal(listed.preferences[0].gameKey, key)
  assert.equal(listed.preferences[0].isFavorite, true)

  const otherUserResponse = await request(`/api/gaming/preferences/${key}`, {
    userId: userB,
    method: 'PATCH',
    body: JSON.stringify({ isFavorite: true }),
  })
  assert.equal(otherUserResponse.status, 404)

  const updatedResponse = await request(`/api/gaming/${gameId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Updated Chess',
      gameUrl: 'https://lichess.org/',
      category: 'Chess and Strategy',
      description: '',
      thumbnailUrl: '',
      icon: '♟️',
    }),
  })
  assert.equal(updatedResponse.status, 200)
  assert.equal((await updatedResponse.json()).game.gameUrl, 'https://lichess.org/')

  const deletedResponse = await request(`/api/gaming/${gameId}`, { method: 'DELETE' })
  assert.equal(deletedResponse.status, 204)
  assert.equal((await request('/api/gaming')).status, 200)
  assert.equal((await request('/api/games')).status, 200)
})

test('legacy search links are never returned as playable URLs', async () => {
  const timestamp = new Date()
  games.push({
    id: '0123456789abcdef01234567',
    userId: userA,
    name: 'Old saved game',
    description: '',
    category: 'Focus Games',
    gameUrl: 'https://www.google.com/search?q=play+old+saved+game',
    thumbnailUrl: null,
    icon: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  try {
    const response = await request('/api/games')
    const result = await response.json()
    const legacyGame = result.games.find((game) => game.id === '0123456789abcdef01234567')
    assert.equal(legacyGame.gameUrl, '')
    assert.equal(legacyGame.category, 'Focus and Concentration')
  } finally {
    const index = games.findIndex((game) => game.id === '0123456789abcdef01234567')
    if (index !== -1) games.splice(index, 1)
  }
})

test('game library accepts HTTP websites and rejects unsafe URLs and categories', async () => {
  const httpWebsite = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'HTTP game',
      gameUrl: 'http://example.com/game',
      category: 'Relaxation Games',
    }),
  })
  const httpGame = await httpWebsite.json()
  assert.equal(httpWebsite.status, 201)
  assert.equal(httpGame.game.gameUrl, 'http://example.com/game')
  await request(`/api/games/${httpGame.game.id}`, { method: 'DELETE' })

  const invalidCategory = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad category',
      gameUrl: 'https://example.com/game',
      category: 'Unknown',
      description: '',
      thumbnailUrl: '',
    }),
  })
  assert.equal(invalidCategory.status, 400)

  const invalidImage = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad image',
      gameUrl: 'https://example.com/game',
      category: 'Arcade Games',
      description: '',
      thumbnailUrl: 'data:text/html;base64,abc',
    }),
  })
  assert.equal(invalidImage.status, 400)

  const unsafeWebsite = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Unsafe link',
      gameUrl: 'javascript:alert(1)',
      category: 'Brain Training',
    }),
  })
  assert.equal(unsafeWebsite.status, 400)

  const searchWebsite = await request('/api/games', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Search page',
      gameUrl: 'https://www.google.com/search?q=play+games',
      category: 'Brain Training',
    }),
  })
  assert.equal(searchWebsite.status, 400)
})
