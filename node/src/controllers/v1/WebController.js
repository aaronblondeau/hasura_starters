const express = require('express')
const { getUserByPasswordResetToken, updateUserPassword, getUserByEmailVerificationToken, verifyUserEmail } = require('../../auth')
const router = express.Router()

async function resetPasswordForm (req, res) {
  try {
    const token = req.params.token
    if (!token) {
      return res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', error: 'token is required!' })
    }

    const user = await getUserByPasswordResetToken(token)
    if (user) {
      res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', token })
    } else {
      res.render('error', { appName: process.env.APP_NAME || 'hasura_starters', message: 'Invalid token.' })
    }
  } catch (error) {
    res.render('error', { appName: process.env.APP_NAME || 'hasura_starters', message: error.message })
  }
}

async function resetPassword (req, res) {
  try {
    const token = req.params.token
    if (!token) {
      return res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', title: 'Password Reset', error: 'token is required!' })
    }

    const user = await getUserByPasswordResetToken(token)
    if (req.body.password && req.body.password_confirmation) {
      const password = req.body.password
      const passwordConfirmation = req.body.password_confirmation

      if (password !== passwordConfirmation) {
        return res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', title: 'Password Reset', token: token, error: 'Passwords did not match!' })
      }
      if (password.length < 5) {
        return res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', title: 'Password Reset', token: token, error: 'Password must be at least 5 characters long.' })
      }

      await updateUserPassword(user.id, password)

      res.render('password_reset_success', { appName: process.env.APP_NAME || 'hasura_starters' })
    } else {
      res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', title: 'Password Reset', token, error: 'Password parameters are missing!' })
    }
  } catch (error) {
    return res.render('password_reset', { appName: process.env.APP_NAME || 'hasura_starters', title: 'Password Reset', token: null, error: error.message })
  }
}

async function verify (req, res) {
  try {
    const token = req.params.token
    if (!token) {
      return res.render('error', { appName: process.env.APP_NAME || 'hasura_starters', message: 'token is required!' })
    }

    const user = await getUserByEmailVerificationToken(token)
    if (user) {
      await verifyUserEmail(user.id)
      res.render('verify_success', { appName: process.env.APP_NAME || 'hasura_starters' })
    } else {
      res.render('error', { appName: process.env.APP_NAME || 'hasura_starters', message: 'Verification token not found!' })
    }
  } catch (error) {
    return res.render('error', { appName: process.env.APP_NAME || 'hasura_starters', error: error.message })
  }
}

router.get('/reset_password/:token', resetPasswordForm)
router.post('/reset_password/:token', resetPassword)
router.get('/verify/:token', verify)

module.exports = {
  router
}
