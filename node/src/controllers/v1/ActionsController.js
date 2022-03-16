const express = require('express')
const _ = require('lodash')
const { default: axios } = require('axios')
const emailValidator = require('email-validator')
const { generateToken, getUserFromTokenWithPassword, hashPassword, comparePasswords, getUserIdFromToken, getUserByEmail, generateRandomToken, updateUserPassword } = require('../../auth')
const sendPasswordResetEmailJob = require('../../jobs/v1/send_password_reset_email')

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
    const hashedPassword = await hashPassword(password)

    console.log((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', hashedPassword, email)

    const createUserResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
    `
    mutation CreateUser {
      insert_users(objects: {email: "${email}", password: "${hashedPassword}"}) {
        returning {
          id
          password
        }
      }
    }
    `
    }, {headers: {
      'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
    }})
    if (createUserResponse.data.errors) {
      throw new Error(response.data.errors[0].message)
    }

    const user = createUserResponse.data.data.insert_users.returning[0]

    // Generate token for user
    const token = generateToken(user.id)

    return res.send({ id: user.id, token })
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

    const user = await getUserByEmail(email)
    if (user) {
      const passwordMatches = await comparePasswords(password, user.password)
      if (!passwordMatches) {
        return res.status(401).json({ message: 'email or password did not match!' })
      }

      // User found and password matched - issue token!
      const token = generateToken(user.id)

      return res.json({ token, id: user.id })
    } else {
      return res.status(400).send({ message: 'email not found!' })
    }
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
    if (newPassword.length < 5) {
      return res.status(400).send({ message: 'New password must be at least 5 characters long.' })
    }
    
    let token = req.headers.authorization || ''

    const user = await getUserFromTokenWithPassword(token, oldPassword)
    if (user) {
      const updatedUser = await updateUserPassword(user.id, newPassword)
      return res.send({ password_at: updatedUser.password_at })
    }
    return res.status(401).json({ message: 'User not found or old password not matched!' })
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

    const user = await getUserFromTokenWithPassword(token, password)
    if (user) {
      const destroyUserResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
      `
      mutation DeleteUser {
        delete_users_by_pk(id: ${user.id}) {
          id
        }
      }
      `
      }, {headers: {
        'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
      }})
      if (destroyUserResponse.data.errors) {
        throw new Error(response.data.errors[0].message)
      }
      return res.send({ success: true })
    } else {
      return res.status(401).json({ message: 'Invalid token.  You must be logged in to perform this action!' })
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

    const user = await getUserByEmail(email)

    if (user) {
      const newToken = generateRandomToken()
      const updateUserResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
      `
      mutation UpdatePasswordResetToken {
        update_users_by_pk(pk_columns: {id: ${user.id}}, _set: {password_reset_token: "${newToken}"}) {
          id
          email
          password_reset_token
        }
      }
      `
      }, {headers: {
        'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
      }})
      if (updateUserResponse.data.errors) {
        throw new Error(response.data.errors[0].message)
      }

      await sendPasswordResetEmailJob.queue(updateUserResponse.data.data.update_users_by_pk)
      return res.send({ success: true })
    }
    
    return res.status(401).json({ message: 'Invalid email!' })
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
