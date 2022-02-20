const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const _ = require('lodash')
const { default: axios } = require('axios')
const { v4: uuidv4 } = require('uuid')
const { redisCache } = require('./cache')

function generateToken (userId) {
  return jwt.sign({
    'x-hasura-allowed-roles': ['user'],
    'x-hasura-default-role': 'user',
    'x-hasura-user-id': userId + ''
  }, process.env.JWT_SECRET, {
    algorithm: process.env.JWT_ALGORITHM || 'HS256'
    // NOTE : This code does not put expirations on tokens - see notes below about password_at checks.
    // Here is how you would put an expiration on a token if needed.
    // expiresIn: process.env.JWT_EXPIRE || '31d'
  })
}

function getUserIdFromToken (token) {
  if (token) {
    token = token.replace('Bearer ', '')
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (_.has(decoded, 'x-hasura-user-id')) {
      return decoded['x-hasura-user-id']
    }
  }
  return null
}

function decodeToken (token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

function matchesUserIdFormat(id) {
  // This should work for relational and mongodb ids
  return _.isNumber(id) || (_.isString(id) && id.length <=16)
}

async function getUserByEmail(email) {
  const userResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
  `
  query GetUser {
    users(where: {email: {_eq: "${email}"}}) {
      id
      password
    }
  }
  `
  }, {headers: {
    'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
  }})
  if (userResponse.data.errors) {
    throw new Error(response.data.errors[0].message)
  }

  if (userResponse.data.data.users) {
    const user = userResponse.data.data.users[0]
    return user
  }
  return null
}

async function _getUserByToken(token, field) {
  const userResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
  `
  query GetUser {
    users(where: {${field}: {_eq: "${token}"}}) {
      id
      password
    }
  }
  `
  }, {headers: {
    'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
  }})
  if (userResponse.data.errors) {
    throw new Error(response.data.errors[0].message)
  }

  if (userResponse.data.data.users) {
    const user = userResponse.data.data.users[0]
    return user
  }
  return null
}

async function getUserByEmailVerificationToken(token) {
  return await _getUserByToken(token, 'email_verification_token')
}

async function getUserByPasswordResetToken(token) {
  return await _getUserByToken(token, 'password_reset_token')
}

async function getUserById(id) {
  return await _getUser(id, false)
}

async function _getUser(id, includePassword) {
  const userResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
  `
  query GetUser {
    users_by_pk(id: ${id}) {
      id
      email
      password_at
      ${includePassword ? 'password' : ''}
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
    return user
  }
  return null
}

async function getUserFromTokenWithPassword (token, password) {
  const id = getUserIdFromToken(token)
  if (id) {
    const user = await _getUser(id, true)
    const passwordMatches = await bcrypt.compare(password, user.password)
    if (passwordMatches) {
      // Scrub password field so there isn't a chance of it getting returned
      delete user.password
      return user
    }
  }
  return null
}

async function getUserFromToken (token) {
  const id = getUserIdFromToken(token)
  if (id) {
    // Make sure user id is numeric to prevent injection attack via crafted token
    if (!matchesUserIdFormat(id)) {
      return null
    }

    // Use graphql to fetch user
    return _getUser(id)
  }
  return null
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10)
}

async function comparePasswords(entered, stored) {
  return await bcrypt.compare(entered, stored)
}

function generateRandomToken() {
  return uuidv4()
}

async function verifyUserEmail(id) {
  const response = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
  `
  mutation UpdatePassword {
    update_users_by_pk(pk_columns: {id: ${id}}, _set: {email_verified: true, email_verification_token: null}) {
      password_at
    }
  }
  `
  }, {headers: {
    'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
  }})
  if (response.data.errors) {
    throw new Error(response.data.errors[0].message)
  }

  return response.data.data.update_users_by_pk
}

async function updateUserPassword(id, password) {
  // Clear any cached token auth responses
  await redisCache.del('auth/user/' + id)

  const hashedNewPassword = await hashPassword(password)
  const response = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
  `
  mutation UpdatePassword {
    update_users_by_pk(pk_columns: {id: ${id}}, _set: {password: "${hashedNewPassword}", password_reset_token: null, password_at: "now()"}) {
      password_at
    }
  }
  `
  }, {headers: {
    'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
  }})
  if (response.data.errors) {
    throw new Error(response.data.errors[0].message)
  }

  return response.data.data.update_users_by_pk
}

module.exports = {
  generateToken,
  getUserIdFromToken,
  getUserFromToken,
  matchesUserIdFormat,
  hashPassword,
  getUserFromTokenWithPassword,
  decodeToken,
  comparePasswords,
  getUserByEmail,
  getUserById,
  generateRandomToken,
  getUserByPasswordResetToken,
  updateUserPassword,
  getUserByEmailVerificationToken,
  verifyUserEmail
}
