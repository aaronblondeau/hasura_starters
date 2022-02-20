const express = require('express')
const router = express.Router()
const sendVerificationEmailJob = require('../../jobs/v1/send_verification_email')

async function handleEvent (req, res) {
  try {
    console.log('~~ event!', req.body.trigger.name, req.method)

    if (req.body.trigger.name === 'users_insert') {
      await sendVerificationEmailJob.queue({id: req.body.event.data.new.id})
    } else if (req.body.trigger.name === 'users_update_email') {
      if (req.body.event.data.new.email != req.body.event.data.old.email) {
        await sendVerificationEmailJob.queue({id: req.body.event.data.new.id})
      }
    }

    return res.json({ success: `Thanks for the ${req.body.trigger.name} Hasura!`, at: new Date().toString() })
  } catch (error) {
    res.status(500).json({ message: error.messsage })
  }
}

router.all('/', handleEvent)

module.exports = {
  router
}
