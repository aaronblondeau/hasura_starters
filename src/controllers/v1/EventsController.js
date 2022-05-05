const express = require('express')
const router = express.Router()

async function handleEvent (req, res) {
  try {
    console.log('~~ event!', req.body.trigger.name, req.method)

    return res.json({ success: `Thanks for the ${req.body.trigger.name} Hasura!`, at: new Date().toString() })
  } catch (error) {
    res.status(500).json({ message: error.messsage })
  }
}

router.all('/', handleEvent)

module.exports = {
  router
}
