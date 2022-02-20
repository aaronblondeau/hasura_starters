const fs = require('fs-extra')
const sendEmail = require('../../email')
const mjml2html = require('mjml')
const Handlebars = require('handlebars')
const { Queue, Worker } = require('bullmq')

const queueName = 'send-password-reset-email'

const connection = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD || null
}

const jobQueue = new Queue(queueName, {
  connection
})

async function queue (payload) {
  if (process.env.BYPASS_QUEUE === 'yes') {
    // For environments where we don't have redis
    execute(payload)
    return null
  } else {
    const result = await jobQueue.add('send_password_reset_email', payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
    return result
  }
}

const worker = new Worker(queueName, async job => {
  await execute(job.data)
}, {
  connection
})

worker.on('completed', (job) => {
  console.log(`${queueName} ${job.id} has completed!`)
})

worker.on('failed', (job, err) => {
  console.log(`${queueName} ${job.id} has failed with ${err.message}`)
})

async function execute (payload) {
  const user = payload
  if (!user.password_reset_token) {
    // Bail if token was unset (reset process completed)
    return
  }
  if (!user.email) {
    // Bail if user doesn't have an email
    return
  }

  const resetPasswordUrl = (process.env.BASE_URL || 'http://localhost:3000') + '/web/reset_password/' + user.password_reset_token

  const appName = process.env.APP_NAME || 'hasura_starters'

  const mjml = await fs.readFile('./src/emails/password_reset.mjml', 'utf8')
  const template = Handlebars.compile(mjml)
  const templateData = { appName, resetPasswordUrl }
  const mjmlFilled = template(templateData)
  const mjmlOut = mjml2html(mjmlFilled)
  const htmlMessage = mjmlOut.html

  const subject = appName + ' password reset request'
  const textMessage = `${appName} has received a request to reset your password.  Please visit ${resetPasswordUrl} to reset your password.  If this action was not initiated by you then please ignore this message.`

  await sendEmail(user.email, subject, textMessage, htmlMessage)
}

exports.queue = queue
exports.name = queueName
