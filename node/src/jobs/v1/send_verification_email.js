const fs = require('fs-extra')
const sendEmail = require('../../email')
const mjml2html = require('mjml')
const Handlebars = require('handlebars')
const { Queue, Worker } = require('bullmq')
const { getUserById } = require('../../auth')
const { v4: uuidv4 } = require('uuid')
const { default: axios } = require('axios')

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
    const result = await jobQueue.add('send_verification_email', payload, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
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
  const userId = payload.id

  const user = await getUserById(userId)
  if (user) {
    const verificatonToken = uuidv4()

    const updateUserResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {query: 
    `
    mutation UpdatePasswordResetToken {
      update_users_by_pk(pk_columns: {id: ${user.id}}, _set: {email_verified: false, email_verification_token: "${verificatonToken}"}) {
        email_verification_token
      }
    }
    `
    }, {headers: {
      'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
    }})
    if (updateUserResponse.data.errors) {
      throw new Error(response.data.errors[0].message)
    }

    const verificationUrl = (process.env.BASE_URL || 'http://localhost:3000') + '/web/verify/' + verificatonToken

    const appName = process.env.APP_NAME || 'hasura_starters'

    const mjml = await fs.readFile('./src/emails/verification.mjml', 'utf8')
    const template = Handlebars.compile(mjml)
    const templateData = { appName, verificationUrl }
    const mjmlFilled = template(templateData)
    const mjmlOut = mjml2html(mjmlFilled)
    const htmlMessage = mjmlOut.html

    const subject = appName + ' verify your email'
    const textMessage = `Please visit ${verificationUrl} to verify your new ${appName} account.`

    await sendEmail(user.email, subject, textMessage, htmlMessage)
  } else {
    console.warn(`send_verification_email could not locate user ${userId}`)
  }
}

exports.queue = queue
exports.name = queueName
