const express = require('express')
const firebase = require('../../firebase')
const _ = require('lodash')
const cache = require('../../cache')

const { redisCache } = cache

const router = express.Router()

async function hasuraAuth (request, response) {
  let token = request.headers.authorization || ''

  if (!token && _.has(request, 'body')) {
    token = request.body.token || ''
  }

  if (!token && _.has(request, 'query')) {
    token = request.query.token || ''
  }

  if (_.startsWith(token, 'Bearer')) {
    token = token.replace('Bearer ', '')
  }

  if (!token) {
    return response.json({
      'x-hasura-role': 'public'
    })
  }

  try {
    const cached = await redisCache.get(token)
    if (cached) {
      if (cached === 'unauthorized') {
        return response.status(401).json({ error: 'unauthorized' })
      }
      return response.json(JSON.parse(cached))
    }

    const decodedToken = await firebase.auth.verifyIdToken(token)
    const { uid } = decodedToken
    if (!uid) {
      // No uid => not authenticated
      await redisCache.set(token, 'unauthorized', { ttl: 1800 })
      response.status(401).json({ error: 'unauthorized' })
      return
    }

    // Check if user has validated their email
    const user = await firebase.auth.getUser(uid)
    if (!user.emailVerified) {
      response.status(401).json({ error: 'email not verified' })
      // Don't cache this
      return
    }

    // Has uid => at least user role
    const role = 'user'

    // TODO - perform other firestore or graphql queries necessary to determine user's role

    const responseData = {
      'X-Hasura-Role': role,
      'X-Hasura-User-Id': uid
    }
    await redisCache.set(token, JSON.stringify(responseData), { ttl: 1800 })
    response.json(responseData)
  } catch (error) {
    await redisCache.set(token, 'unauthorized', { ttl: 1800 })
    console.error(error)
    response.status(401).json({ error: 'unauthorized' })
  }
}

router.get('/', hasuraAuth)
router.post('/', hasuraAuth)

module.exports = {
  router
}
