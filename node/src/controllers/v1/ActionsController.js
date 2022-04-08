const express = require('express')
const _ = require('lodash')
const emailValidator = require('email-validator')
const { decodeToken, getUserIdFromTokenPayload } = require('../../auth')
const { getKeycloakAdminClient, generateToken, refreshToken } = require('../../keycloak')
const sendPasswordResetEmailJob = require('../../jobs/v1/send_password_reset_email')
const sendVerificationEmailJob = require('../../jobs/v1/send_verification_email')

const router = express.Router()

async function register (req, res) {
  try {
    let email = null
    if (_.has(req, 'body.input.email')) {
      email = req.body.input.email
    } else {
      return res.status(400).send({ message: 'Email is required.' })
    }
    // Always handle emails in lowercase on the backend
    email = email.toLowerCase()

    // Make sure email is valid and prevent GraphQL injection attack via email field:
    const isValidEmail = emailValidator.validate(email)
    if (!isValidEmail) {
      return res.status(400).send({ message: 'Email is invalid!' })
    }

    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'Password is required.' })
    }

    const kcAdminClient = await getKeycloakAdminClient()

    // Create user
    const newUser = await kcAdminClient.users.create({
      realm: process.env.KEYCLOAK_REALM || 'hasura_starters',
      username: email,
      email,
      emailVerified: false,
      enabled: true
    })

    const userId = newUser.id

    // Set password
    await kcAdminClient.users.resetPassword({
      id: userId,
      credential: {
        temporary: false,
        type: 'password',
        value: password,
      }
    })

    // Assign "user" role within "hasura_staters" client
    await kcAdminClient.users.addClientRoleMappings({
      id: userId,
      clientUniqueId: process.env.KEYCLOAK_CLIENT_ID || 'f73dccbc-a65e-4f1f-930f-8d559754901b',

      // at least id and name should appear
      roles: [
        {
          id: process.env.KEYCLOAK_USER_ROLE_ID || '6bed1cf6-935f-4c4b-a7a4-e2a7eb0c3719',
          name: 'user',
        }
      ]
    })

    // Send verify email (in a job)
    await sendVerificationEmailJob.queue({ userId })
  
    const tokenSet = await generateToken(email, password)

    res.json({
      access_token: tokenSet.access_token,
      expires_at: tokenSet.expires_at,
      refresh_expires_in: tokenSet.refresh_expires_in,
      refresh_token: tokenSet.refresh_token,
      id: userId
    })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function login (req, res) {
  try {
    let email = _.has(req, 'body.input.email') ? req.body.input.email : ''
    let password = _.has(req, 'body.input.password') ? req.body.input.password : ''

    if (!email && _.has(req, 'body.email')) {
      email = req.body.email || ''
    }
    if (!email && _.has(req, 'query.email')) {
      email = req.query.email || ''
    }
    // Always handle emails in lowercase on backend
    email = email.toLowerCase()

    // Make sure email is valid and prevent GraphQL injection attack via email field:
    const isValidEmail = emailValidator.validate(email)
    if (!isValidEmail) {
      return res.status(400).send({ message: 'Email is invalid!' })
    }

    if (!password && _.has(req, 'body.password')) {
      password = req.body.password || ''
    }
    if (!password && _.has(req, 'query.password')) {
      password = req.query.password || ''
    }

    if (!password || !email) {
      return res.status(401).json({ message: 'Both password and email must be provided!' })
    }

    const tokenSet = await generateToken(email, password)
    const decoded = await decodeToken(tokenSet.access_token)
    const id = getUserIdFromTokenPayload(decoded)

    res.json({
      access_token: tokenSet.access_token,
      expires_at: tokenSet.expires_at,
      refresh_expires_in: tokenSet.refresh_expires_in,
      refresh_token: tokenSet.refresh_token,
      id
    })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function whoami (req, res) {
  try {
    let token = req.headers.authorization || ''
    const decoded = decodeToken(token.replace('Bearer ', ''))
    const id = getUserIdFromTokenPayload(decoded)
    if (id) {
      // // Profile info is already in token, however, could use following for a test of keycloak accounts api
      // // Required enabling accounts api : https://www.keycloak.org/server/features
      // const response = await axios.get((process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080/realms/hasura_starters') + '/account', {
      //   headers: {
      //     'Authorization': token
      //   }
      // })
      // console.log(response.data)

      return res.send({
        email: decoded.email,
        email_verified: decoded.email_verified,
        id
      })
    }
    return res.status(401).json({ message: 'Invalid token.  You must be logged in to perform this action!' })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function changePassword (req, res) {
  try {
    let oldPassword = ''
    if (_.has(req, 'body.input.old_password')) {
      oldPassword = req.body.input.old_password
    } else {
      return res.status(400).send({ message: 'Old password is required.' })
    }

    let newPassword = ''
    if (_.has(req, 'body.input.new_password')) {
      newPassword = req.body.input.new_password
    } else {
      return res.status(400).send({ message: 'New password is required.' })
    }
    
    let token = req.headers.authorization || ''
    const kcAdminClient = await getKeycloakAdminClient()

    const decoded = decodeToken(token.replace('Bearer ', ''))
    const id = getUserIdFromTokenPayload(decoded)
    if (id) {
      const tokenSet = await generateToken(decoded.email, oldPassword)
      // If success, change password
      if (tokenSet && tokenSet.access_token) {
        await kcAdminClient.users.resetPassword({
          id,
          credential: {
            temporary: false,
            type: 'password',
            value: newPassword,
          }
        })
        return res.send({ success: true })
      } else {
        throw new Error('Password did not match')
      }
    } else {
      throw new Error('Invalid session')
    }
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function destroyUser (req, res) {
  try {
    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'password is required.' })
    }

    let token = req.headers.authorization || ''
    const kcAdminClient = await getKeycloakAdminClient()

    const decoded = decodeToken(token.replace('Bearer ', ''))
    const id = getUserIdFromTokenPayload(decoded)
    if (id) {
      const tokenSet = await generateToken(decoded.email, password)
      // If success, delete
      if (tokenSet && tokenSet.access_token) {
        await kcAdminClient.users.del({
          id,
        })
        return res.send({ success: true })
      } else {
        throw new Error('Password did not match')
      }
    } else {
      throw new Error('Invalid session')
    }
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function resetPassword (req, res) {
  try {
    let email = ''
    if (_.has(req, 'body.input.email')) {
      email = req.body.input.email
    } else {
      return res.status(400).send({ message: 'Email is required.' })
    }
    email = email.toLowerCase()

    const isValidEmail = emailValidator.validate(email)
    if (!isValidEmail) {
      return res.status(400).send({ message: 'Email is invalid!' })
    }

    const kcAdminClient = await getKeycloakAdminClient()

    const found = await kcAdminClient.users.find({email})
    if (found.length > 0) {
      const user = found[0]

      await sendPasswordResetEmailJob.queue({ userId: user.id })

      return res.send({ success: true })
    } else {
      throw new Error('No user found.')
    }
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function loginRefresh (req, res) {
  try {
    let refresh_token = ''
    if (_.has(req, 'body.input.refresh_token')) {
      refresh_token = req.body.input.refresh_token
    } else {
      return res.status(400).send({ message: 'refresh_token is required.' })
    }

    const tokenSet = await refreshToken(refresh_token)
    const decoded = decodeToken(tokenSet.access_token)
    const id = getUserIdFromTokenPayload(decoded)

    res.json({
      access_token: tokenSet.access_token,
      expires_at: tokenSet.expires_at,
      refresh_expires_in: tokenSet.refresh_expires_in,
      refresh_token: tokenSet.refresh_token,
      id
    })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

router.post('/register', register)
router.post('/login', login)
router.post('/whoami', whoami)
router.post('/changePassword', changePassword)
router.post('/destroyUser', destroyUser)
router.post('/resetPassword', resetPassword)
router.post('/loginRefresh', loginRefresh)

module.exports = {
  router
}
