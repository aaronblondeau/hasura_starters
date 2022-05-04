const express = require('express')
const _ = require('lodash')
const { default: axios } = require('axios')
const sendPasswordResetEmailJob = require('../../jobs/v1/send_password_reset_email')
const sendVerificationEmailJob = require('../../jobs/v1/send_verification_email')
const createUserProfile = require('../../jobs/v1/create_user_profile')
const destroyUserProfile = require('../../jobs/v1/destroy_user_profile')
const { redisCache } = require('../../cache')
const firebase = require('../../firebase')

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

    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'Password is required.' })
    }
    if (password.length < 5) {
      return res.status(400).send({ message: 'Password must be at least 5 characters long.' })
    }

    // Create the user in firebase
    const user = await firebase.auth.createUser({
        email,
        emailVerified: false,
        password,
        disabled: false,
      })

    // Create user profile record in our db
    await createUserProfile.queue({ uid: user.uid })

    // Send verification email
    await sendVerificationEmailJob.queue({ uid: user.uid, email })

    return res.send({ id: user.uid })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function whoami (req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')

    const decodedToken = await firebase.auth.verifyIdToken(token)
    const { uid } = decodedToken
    const user = await firebase.auth.getUser(uid)

    const userResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
    `
    query GetUserProfile {
      userProfile(id: "${uid}") {
        displayName
      }
    }
    `
    }, {headers: {
      'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
    }})
    if (userResponse.data.errors) {
      throw new Error(response.data.errors[0].message)
    }

    if (user) {
      return res.send({
        id: uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: userResponse.data.data.userProfile.displayName
      })
    }
    return res.status(401).json({ message: 'Invalid token.  You must be logged in to perform this action!' })
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

    await sendPasswordResetEmailJob.queue({ email })

    return res.send({ success: true })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

async function destroyUser (req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')

    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'password is required.' })
    }

    const decodedToken = await firebase.auth.verifyIdToken(token)
    const { uid } = decodedToken
    const user = await firebase.auth.getUser(uid)

    // verify password
    // https://cloud.google.com/identity-platform/docs/use-rest-api#section-sign-in-email-password
    // https://stackoverflow.com/questions/52523367/firebase-admin-sdk-check-users-password-against-variable-on-server
    const passwordCheckResult = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
      email: user.email,
      password
    })

    if (passwordCheckResult.data.idToken) {
      await firebase.auth.deleteUser(uid)
  
      // Create job to cleanup after user:
      await destroyUserProfile.queue({ uid })

      // Remove this token from the cache
      await redisCache.del(token)
  
      return res.send({ success: true })
    } else {
      return res.status(400).send({ message: 'Password did not match!' })
    }
  } catch (error) {
    console.error(error)
    if (error.response) {
      // Axios error => password failed
      return res.status(400).send({ message: 'Password did not match!' })
    } else {
      return res.status(400).send({ message: error.message + '' })
    }
  }
}

async function updateEmail (req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')

    let password = ''
    if (_.has(req, 'body.input.password')) {
      password = req.body.input.password
    } else {
      return res.status(400).send({ message: 'password is required.' })
    }

    let email = null
    if (_.has(req, 'body.input.email')) {
      email = req.body.input.email
    } else {
      return res.status(400).send({ message: 'New email is required.' })
    }
    // Always handle emails in lowercase on the backend
    email = email.toLowerCase()

    const decodedToken = await firebase.auth.verifyIdToken(token)
    const { uid } = decodedToken
    const user = await firebase.auth.getUser(uid)

    // verify password
    // https://cloud.google.com/identity-platform/docs/use-rest-api#section-sign-in-email-password
    // https://stackoverflow.com/questions/52523367/firebase-admin-sdk-check-users-password-against-variable-on-server
    const passwordCheckResult = await axios.post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
      email: user.email,
      password
    })

    if (passwordCheckResult.data.idToken) {
      // Note, if users manage to call updateEmail from within the browser, emailVerified will get set to false
      // but the email job won't get triggered here.  Users in this condition will need to use resendEmailValidate.
      await firebase.auth.updateUser(uid, {
        email,
        emailVerified: false
      })

      await sendVerificationEmailJob.queue({ uid: user.uid, email })

      // Remove this token from the cache
      await redisCache.del(token)

      return res.send({ success: true })
    } else {
      return res.status(400).send({ message: 'Password did not match!' })
    }
  } catch (error) {
    console.error(error)
    if (error.response) {
      // Axios error => password failed
      return res.status(400).send({ message: 'Password did not match!' })
    } else {
      return res.status(400).send({ message: error.message + '' })
    }
  }
}

async function resendEmailValidate (req, res) {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')

    const decodedToken = await firebase.auth.verifyIdToken(token)
    const { uid } = decodedToken
    const user = await firebase.auth.getUser(uid)

    // NOTE : User will see a message from firebase saying "You can now sign in with your NEW account" - may cause user confusion.
    await sendVerificationEmailJob.queue({ email: user.email })

    return res.send({ success: true })
  } catch (error) {
    console.error(error)
    return res.status(400).send({ message: error.message + '' })
  }
}

router.post('/register', register)
router.post('/whoami', whoami)
router.post('/resetPassword', resetPassword)
router.post('/destroyUser', destroyUser)
router.post('/updateEmail', updateEmail)
router.post('/resendEmailValidate', resendEmailValidate)

module.exports = {
  router
}
