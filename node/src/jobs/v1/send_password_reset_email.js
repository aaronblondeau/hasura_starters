const fs = require('fs-extra')
const { Queue, Worker } = require('bullmq')
const { getKeycloakAdminClient } = require('../../keycloak')

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
  const { userId } = payload
  const kcAdminClient = await getKeycloakAdminClient()

  await kcAdminClient.users.executeActionsEmail({
    id: userId,
    lifespan: 43200,
    actions: ['UPDATE_PASSWORD'],
  })
}

exports.queue = queue
exports.name = queueName
