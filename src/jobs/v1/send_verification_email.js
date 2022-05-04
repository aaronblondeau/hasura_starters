const fs = require('fs-extra')
const sendEmail = require('../../email')
const mjml2html = require('mjml')
const Handlebars = require('handlebars')
const { Queue, Worker } = require('bullmq')
const firebase = require('../../firebase')

const queueName = 'send-verification-email'

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
    const result = await jobQueue.add(queueName, payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
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
  const email = payload.email

  // https://firebase.google.com/docs/auth/admin/email-action-links#generate_email_verification_link
  // TODO - send second param "actionCodeSettings" to set redirect url, app handling, etc...
  const verificationUrl = await firebase.auth.generateEmailVerificationLink(email)

  const appName = process.env.APP_NAME || 'hasura_starters'

  const mjml = await fs.readFile('./src/emails/verification.mjml', 'utf8')
  const template = Handlebars.compile(mjml)
  const templateData = { appName, verificationUrl }
  const mjmlFilled = template(templateData)
  const mjmlOut = mjml2html(mjmlFilled)
  const htmlMessage = mjmlOut.html

  const subject = appName + ' verify your email'
  const textMessage = `Please visit ${verificationUrl} to verify your new ${appName} account.`

  await sendEmail(email, subject, textMessage, htmlMessage)
}

exports.queue = queue
exports.name = queueName
