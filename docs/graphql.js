// This is a graphql plugin for nuxt2.
// To use, place in plugins directory.
// Then add to nuxt.config.js:
/*
  plugins: [
    '~/plugins/graphql.js'
  ]
*/
// You'll also need to add env vars to point the plugin
// at the right environment:
/*
  env: {
    hasuraGraphQLHttpUrl: process.env.HASURA_GRAPH_QL_HTTP_URL || 'http://localhost:8000/v1/graphql',
    hasuraGraphQLWsUrl: process.env.HASURA_GRAPH_QL_WS_URL || 'ws://localhost:8000/v1/graphql'
  },
*/

import { request, gql } from 'graphql-request'
import _ from 'lodash'
import { createClient } from 'graphql-ws'

export default ({ store }, inject) => {
  // Add $graphql to application scope.  A simple wrapper around graphql-request
  inject('graphql', async (query, variables, authenticate) => {
    try {
      if (!variables) {
        variables = null
      }

      let headers = null
      if (authenticate) {
        if (_.isObject(authenticate)) {
          headers = authenticate
          headers.Authorization = 'Bearer ' + store.state.auth.token
        } else {
          headers = { Authorization: 'Bearer ' + store.state.auth.token }
        }
      }

      const result = await request(process.env.hasuraGraphQLHttpUrl, gql`${query}`, variables, headers)
      return result
    } catch (error) {
      // Re-throw errors as a normal Error/message
      if (_.has(error, 'response.errors.0.message')) {
        throw new Error(error.response.errors[0].message)
      }
      throw (error)
    }
  })

  inject('graphqlws', (query, variables, authenticate, nextCallback, clientCallback) => {
    // Add $graphqlws to application scope.  A simple wrapper around graphql-ws

    // https://hasura.io/docs/latest/graphql/core/databases/postgres/subscriptions/index.html
    // https://github.com/hasura/graphql-engine/issues/6264
    // https://github.com/enisdenjo/graphql-ws/search?q=Bearer

    const clientParams = {
      url: process.env.hasuraGraphQLWsUrl
    }
    if (authenticate) {
      clientParams.connectionParams = () => {
        let headers = {}
        if (_.isObject(authenticate)) {
          headers = authenticate
        }
        headers = { Authorization: 'Bearer ' + store.state.auth.token }
        return { headers }
      }
    }

    const client = createClient(clientParams)

    const payload = {
      query
    }

    if (variables) {
      payload.variables = variables
    }

    return new Promise((resolve, reject) => {
      client.subscribe(payload, {
        next: (data) => {
          nextCallback(data.data)
        },
        error: reject,
        complete: () => {
          resolve()
          client.dispose()
        }
      })

      if (clientCallback) {
        clientCallback(client)
      }
    })
  })
}
