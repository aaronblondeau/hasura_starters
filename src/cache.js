const cacheManager = require('cache-manager')
const redisStore = require('cache-manager-ioredis')

let redisCache = null

redisCache = cacheManager.caching({
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // redis cache defaults to 0
  db: parseInt(process.env.CACHE_REDIS_DB || '1'),
  password: process.env.REDIS_PASSWORD || null,
  ttl: 1800
})

// listen for redis connection error event
const redisClient = redisCache.store.getClient()

redisClient.on('error', (error) => {
  // handle error here
  console.log('~~ Cache redis client error', error)
})

redisClient.on('connect', () => {
  console.log('~~ Cache connected')
})

module.exports = { redisCache }
