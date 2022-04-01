const jwt = require('jsonwebtoken')
const jwkToPem = require('jwk-to-pem')

function getUserIdFromToken (token) {
  if (token) {
    token = token.replace('Bearer ', '')
    const decoded = decodeToken(token)
    if (decoded['https://hasura.io/jwt/claims'] && decoded['https://hasura.io/jwt/claims']['x-hasura-user-id']) {
      return decoded['https://hasura.io/jwt/claims']['x-hasura-user-id']
    }
  }
  return null
}

function decodeToken (token) {
  // TODO - fetch from http://localhost:3000/auth/jwt/jwks.json ???
  const certString = jwkToPem(
    JSON.parse(
      process.env.ST_JWK || `{
        "kty":"RSA",
        "kid":"a0f58824-915d-4809-88f2-ed296009c86a",
        "n":"5lXJmnvZjygUlYWv0Qze7bhYDUHuBaHkD9bChqbOHa7OX32YqBApgqUkg-t0Z1-vsP9eL59wHb3fVAyPVGB8HRf0Yakv3Q7C_q91fxVQh6ybpk66cV2LuN_rIKQoYkIyqARBYkMpb4RdTtM7HCmGl-wKQGia101ani6UxMF9mXCLaxeu5Ehd_dhCt4ekpD3dYR6r6BnIzNBqAnpAhLIUGboRCJHeYZOlYxmT25PqVXCrajFnkoHVfASlCkRRHROyi1sgKfTIyH48zxkBewve8NJckcibRQw7Tl2nUAbxWKF3zAtIqQC33W3WwPhDmTEV0VjStVJosG1-maMX_ypmjQ",
        "e":"AQAB",
        "alg":"RS256",
        "use":"sig"
      }`
    )
  )
  return jwt.verify(token, certString)
}

module.exports = {
  getUserIdFromToken,
  decodeToken,
}
