const admin = require('firebase-admin')

// eslint-disable-next-line
const serviceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT || '').startsWith('/') ? process.env.FIREBASE_SERVICE_ACCOUNT : require('../service_accounts/' + process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const firestore = admin.firestore()
const auth = admin.auth()

const settings = { timestampsInSnapshots: true }
firestore.settings(settings)

module.exports = { admin, firestore, auth }
