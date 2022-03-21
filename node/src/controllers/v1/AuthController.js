const express = require('express')
const _ = require('lodash')
const { redisCache } = require('../../cache')
const { DateTime } = require('luxon')
const { default: axios } = require('axios')
const { matchesUserIdFormat, getUserIdFromToken, decodeToken } = require('../../auth')

const router = express.Router()

async function hasuraAuth (req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Authentication action is not properly configured!' })
    }

    let token = req.headers.authorization || ''

    if (!token && _.has(req, 'body.token')) {
      token = req.body.token || ''
    }

    if (!token && _.has(req, 'query.token')) {
      token = req.query.token || ''
    }

    if (token && (_.startsWith(token, 'Bearer'))) {
      token = token.replace('Bearer ', '')
    }

    if (!token) {
      return res.json({
        'x-hasura-role': 'public'
      })
    }

    const userId = getUserIdFromToken(token)
    if (userId) {
      let cacheKey = 'auth/user/' + userId
      // if (_.has(req.headers, 'x-requested-role')) {
      //   cacheKey = cacheKey + ':' + req.headers['x-requested-role']
      // }

      let useCache = true
      if (process.env.DISABLE_AUTH_CACHE === 'yes') {
        useCache = false
      }

      // Use cache to prevent roundtrip to database here
      let cached = null
      if (useCache) {
        cached = await redisCache.get(cacheKey)
      }
      if (cached) {
        return res.json(cached)
      }

      // Make sure userId is numeric to prevent injection attack via crafted token
      if (!matchesUserIdFormat(userId)) {
        return res.status(400).send({ message: 'Bad token!' })
      }

      // Use graphql to fetch user
      const userResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
      `
      query GetUser {
        users_by_pk(id: ${userId}) {
          id
          password_at
        }
      }
      `
      }, {headers: {
        'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
      }})
      if (userResponse.data.errors) {
        throw new Error(response.data.errors[0].message)
      }

      if (userResponse.data.data.users_by_pk) {
        const user = userResponse.data.data.users_by_pk
        const passwordAt = DateTime.fromISO(user.password_at).toJSDate()
        const userIat = Math.ceil(passwordAt.getTime() / 1000)

        const decoded = decodeToken(token)

        // If user has changed password after the token was generated, reject access
        if (decoded.iat < userIat) { // subtract 10 seconds is here to prevent timing issues between postgres and token issue when a token is created right when user registers
          return res.status(401).json({ message: 'Token has been invalidated!' })
        }

        let response = {
          'x-hasura-role': 'user',
          'x-hasura-user-id': user.id + ''
        }

        if (useCache) {
          await redisCache.set(cacheKey, response)
        }
        return res.json(response)
      }
    }

    return res.json({
      'x-hasura-role': 'public'
    })
  } catch (error) {
    console.error(error)
    return res.status(401).json({ message: error.message })
  }
}

router.get('/', hasuraAuth)
router.post('/', hasuraAuth)

module.exports = {
  router
}
