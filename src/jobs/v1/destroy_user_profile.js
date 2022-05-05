const { Queue, Worker } = require('bullmq')
const { default: axios } = require('axios')

const queueName = 'destroy-user-profile'

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
  const uid = payload.uid

  // Create user profile record (using our own db instead of firebase)
  const destroyUserResponse = await axios.post((process.env.HASURA_BASE_URL || 'http://localhost:8000') + '/v1/graphql', {
    query:
    `
    mutation DeleteUserProfile {
      deleteUserProfile(id: "${uid}") {
        id
      }
    }
    `
  }, {
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET
    }
  })
  if (destroyUserResponse.data.errors) {
    throw new Error(destroyUserResponse.data.errors[0].message)
  }
}

exports.queue = queue
exports.name = queueName
