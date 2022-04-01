const express = require('express')
const router = express.Router()
const cors = require('cors')

const supertokens = require('supertokens-node')
const Session = require('supertokens-node/recipe/session')
const EmailPassword = require('supertokens-node/recipe/emailpassword')
const { middleware, errorHandler  } = require('supertokens-node/framework/express')

supertokens.init({
  framework: "express",
  supertokens: {
      // try.supertokens.com is for demo purposes. Replace this with the address of your core instance (sign up on supertokens.com), or self host a core.
      connectionURI: "http://localhost:3567",
      // apiKey: "IF YOU HAVE AN API KEY FOR THE CORE, ADD IT HERE",
  },
  appInfo: {
      // learn more about this on https://supertokens.com/docs/session/appinfo
      appName: "Hasura Starters",
      apiDomain: "http://localhost:3000",
      websiteDomain: "http://localhost:3000",
      apiBasePath: "/auth",
      websiteBasePath: "/web",
  },
  recipeList: [
      // https://supertokens.com/docs/nodejs/emailpassword/init
      EmailPassword.init(), // initializes signin / sign up features
      Session.init({
        jwt: {
          enable: true
        },
        override: {
          functions: function (originalImplementation) {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {

                input.accessTokenPayload = {
                  ...input.accessTokenPayload,
                  "https://hasura.io/jwt/claims": {
                    "x-hasura-user-id": input.userId,
                    "x-hasura-default-role": "user",
                    "x-hasura-allowed-roles": ["user"],
                  }
                }

                return originalImplementation.createNewSession(input)
              }
            }
          }
        }
      }) // initializes session features
  ]
})

router.use(cors({
  origin: ["http://localhost:3000", "https://hoppscotch.io/"],
  allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
  credentials: true,
}))
router.use(middleware())
console.log("~~ Mounted supertokens")

router.use(errorHandler())

module.exports = {
  router
}
