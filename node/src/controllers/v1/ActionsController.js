const express = require('express')
const _ = require('lodash')
const emailValidator = require('email-validator')
const { getUserIdFromToken } = require('../../auth')
const sendPasswordResetEmailJob = require('../../jobs/v1/send_password_reset_email')
const sendVerificationEmailJob = require('../../jobs/v1/send_verification_email')
const { DateTime } = require('luxon')
const Session = require('supertokens-node/recipe/session')
const EmailPassword = require('supertokens-node/recipe/emailpassword')
const { deleteUser } = require('supertokens-node')

const router = express.Router()

async function register (req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Authentication action is not properly configured!' })
    }

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
    if (password.length < 5) {
      return res.status(400).send({ message: 'Password must be at least 5 characters long.' })
    }

    const signup = await EmailPassword.signUp(email, password)
    const user = signup.user

    const verify = await EmailPassword.createEmailVerificationToken(user.id)

    // TODO - send verify.token in an email
    console.log('~~ TODO send email verification token ' + verify.token)

    await Session.createNewSession(res, user.id)
    let sessionHandles = await Session.getAllSessionHandlesForUser(user.id)
    let token = ''

    for (const handle of sessionHandles) {
      const sessionInfo = await Session.getSessionInformation(handle)
      const jwt = sessionInfo.accessTokenPayload["jwt"]
      if (jwt) {
        token = jwt
      }
    }
    return res.json({ token, id: user.id })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function login (req, res) {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Authentication action is not properly configured!' })
    }

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

    const signin = await EmailPassword.signIn(email, password)
    if (signin.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new Error('Incorrect email or password!')
    }
    const user = signin.user
    await Session.createNewSession(res, user.id)
    let sessionHandles = await Session.getAllSessionHandlesForUser(user.id)
    let token = ''

    for (const handle of sessionHandles) {
      const sessionInfo = await Session.getSessionInformation(handle)
      const jwt = sessionInfo.accessTokenPayload["jwt"]
      if (jwt) {
        token = jwt
      }
    }
    return res.json({ token, id: user.id })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function whoami (req, res) {
  try {
    let token = req.headers.authorization || ''
    const id = getUserIdFromToken(token)
    if (id) {
      return res.send({
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

    const id = getUserIdFromToken(token)
    const user = await EmailPassword.getUserById(id)
    // Check old password
    const signin = await EmailPassword.signIn(user.email, oldPassword)
    if (signin.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new Error('Old password did not match!')
    }
    // Save new password
    await EmailPassword.updateEmailOrPassword({
      userId: user.id,
      password: newPassword
    })

    // TODO Kill old sessions
    // This does not revoke tokens...
    // await Session.revokeAllSessionsForUser(user.id)

    return res.send({ password_at: DateTime.now().toISO() })
    
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

// https://supertokens.com/docs/emailpassword/common-customizations/delete-user
async function destroyUser (req, res) {
  try {
    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'password is required.' })
    }

    let token = req.headers.authorization || ''

    const id = getUserIdFromToken(token)
    const user = await EmailPassword.getUserById(id)
    // Check old password
    const signin = await EmailPassword.signIn(user.email, password)
    if (signin.status === 'WRONG_CREDENTIALS_ERROR') {
      throw new Error('Password did not match!')
    }

    await deleteUser(user.id)

    return res.send({ success: true })
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

    const user = await EmailPassword.getUserByEmail(email)
    const reset = await EmailPassword.createResetPasswordToken(user.id)

    // TODO - send reset.token in an email
    console.log('~~ TODO send password reset verification token ' + reset.token)

    return res.send({ success: true })

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

module.exports = {
  router
}
