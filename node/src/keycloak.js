const KcAdminClient = require('@keycloak/keycloak-admin-client').default
const { Issuer } = require('openid-client')

async function getKeycloakAdminClient () {
  const kcAdminClient = new KcAdminClient({
    baseUrl: 'http://localhost:8080',
    realmName: 'hasura_starters'
  })

  await kcAdminClient.auth({
    // TODO (cannot get this to work)
    // clientSecret: '...',
    // grantType: 'client_credentials',
    // clientId: 'admin-cli'

    // TODO - From ENV
    username: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    clientId: 'admin-cli',
    grantType: 'password'
  })
  return kcAdminClient
}

async function refreshToken (token) {
  const keycloakIssuer = await Issuer.discover(
    process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080/realms/hasura_starters',
  );
  
  const client = new keycloakIssuer.Client({
    client_id: process.env.KEYCLOAK_REALM || 'hasura_starters',
    token_endpoint_auth_method: 'none',
  })

  const tokenSet = await client.refresh(token)
  return tokenSet
}

async function generateToken (email, password) {
  const keycloakIssuer = await Issuer.discover(
    process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080/realms/hasura_starters',
  );
  
  const client = new keycloakIssuer.Client({
    client_id: process.env.KEYCLOAK_REALM || 'hasura_starters',
    token_endpoint_auth_method: 'none',
  })

  const tokenSet = await client.grant({
    grant_type: 'password',
    username: email,
    password: password
  })
  return tokenSet
}

module.exports = {
  getKeycloakAdminClient,
  generateToken,
  refreshToken
}
