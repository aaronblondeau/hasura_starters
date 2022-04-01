require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http')
const authController = require('./controllers/v1/AuthController')
const actionsController = require('./controllers/v1/ActionsController')
const eventsController = require('./controllers/v1/EventsController')
const webController = require('./controllers/v1/WebController')
const terminus = require('@godaddy/terminus')
const path = require('path')
const { Queue, FlowProducer, QueueScheduler } = require('bullmq')
const Arena = require('bull-arena')
const basicAuth = require('basic-auth-connect')

const sendVerificationEmail = require('./jobs/v1/send_verification_email')
const sendPasswordResetEmail = require('./jobs/v1/send_password_reset_email')
const { default: axios } = require('axios')

const queues = [
  sendVerificationEmail,
  sendPasswordResetEmail
]

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(bodyParser.json({ limit: (process.env.BODYPARSER_SIZE_LIMIT || '50mb') }))
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, './views'))

// Static files are in /public
app.use(express.static('./src/public'))

app.get('/', (req, res) => {
  res.send('Howdy!')
})

app.get('/readycheck', (req, res) => {
  res.send('ready')
})

app.all('/healthcheck', async (req, res) => {
  // Check network connection with hasura
  const hasuraCheck = await axios.get((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/version')
  res.json({ healthy: true, hasura: hasuraCheck.data })
})

app.use('/', authController.router)
app.use('/hasura/actions', actionsController.router)
app.use('/hasura/events', eventsController.router)
app.use('/web', webController.router)

const redis = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD || null,
  // arena defaults db 1
  db: parseInt(process.env.ARENA_REDIS_DB || '0')
}

const arenaQueues = []
const queueSchedulers = []
for (const queue of queues) {
  queueSchedulers.push(new QueueScheduler(queue.name, { connection: redis }))
  arenaQueues.push(
    {
      type: 'bullmq',
      name: queue.name,
      hostId: 'node-hasura',
      redis
    }
  )
}

const arena = Arena({
  BullMQ: Queue,
  FlowBullMQ: FlowProducer,
  queues: arenaQueues
}, {
  disableListen: true
})
// Only serve arena UI if a password is set
if (process.env.ARENA_PASS) {
  app.use('/jobs', basicAuth(process.env.ARENA_USER || 'arena', process.env.ARENA_PASS), arena)
}

// Default error handler
app.use(function (err, req, res, next) {
  if (err.name === 'NotFoundError') {
    console.error('!! 404', req.path)
    return res.status(404).send({ message: err.message })
  } else if (err.name === 'InvalidTokenError') {
    console.error('!! 401', req.path)
    return res.status(401).send({ message: err.message })
  } else {
    console.error('!! 500', req.path, err.stack)
    return res.status(500).send({ message: err.message })
  }
})

// Graceful shutdown - can be disabled with an env var
if (process.env.GRACEFUL_SHUTDOWN !== 'no') {
  console.log('~~ Enabling graceful shutdown')
  terminus.createTerminus(server, {
    signal: 'SIGINT',
    signals: ['SIGUSR1', 'SIGUSR2'],
    timeout: 31000,
    onSignal: async () => {
      // Cleanup all resources
      console.log('~~ Terminus signal : cleaning up...')

      for (const queueScheduler of queueSchedulers) {
        await queueScheduler.close()
      }
    },
    onShutdown: async () => {
      console.log('~~ Terminus shutdown complete.')
    }
  })
}

const port = parseInt(process.env.PORT || '3000')
server.listen(port, () => console.log(`~~ API listening on port ${port}!`))
