const jwt = require('jsonwebtoken')
const jwkToPem = require('jwk-to-pem')

function getUserIdFromTokenPayload (decoded) {
  if (decoded['https://hasura.io/jwt/claims'] && decoded['https://hasura.io/jwt/claims']['x-hasura-user-id']) {
    return decoded['https://hasura.io/jwt/claims']['x-hasura-user-id']
  }
  return null
}

function decodeToken (token) {
  // TODO - fetch from server? (use only rsa256 entry!) http://localhost:8080/realms/hasura_starters/protocol/openid-connect/certs
  // NOTE - key is also at http://localhost:8080/hasura_starters/hasura
  const certString = jwkToPem(
    JSON.parse(
      process.env.ST_JWK || `{
        "kid": "igf8PxLLHm0NMnzEyKIqi4fqR5vzAujJaVd4T19-vUA",
        "kty": "RSA",
        "alg": "RS256",
        "use": "sig",
        "n": "y6uNXXYcOEsU1m2wj5NkIM4gUh-iufeO66DoylSB_IWUj42yiVRM78prxJPDMah2QKBRbZhPiNKFl1hK2PTw4eKPMMum4zJW0_ZEvtfa-aYgHDWPjhevdjZBo-wkfydNcrv4rC2uMrlCdvxUBegk1RM9GfQKIkl3xGEC5rzz8mjvrO5yEnBLB3TD8TcRoCy-0RZ4WaHhAIR2-jtOq2PxIkMKZ14hCR_m4bri09Bh76v_VRrGVTP-BbBsJbWuacVC_gYxRmuwvnFTdzKPD9l6iw_oKZ7nbYjzQDibeMoJhLuzYHGQ0IeUu5wNccMR2W47j-LMrv1dOZTG22fiAz4YdQ",
        "e": "AQAB",
        "x5c": [
            "MIICmzCCAYMCBgGABdFJ4jANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZoYXN1cmEwHhcNMjIwNDA3MjA1NTQzWhcNMzIwNDA3MjA1NzIzWjARMQ8wDQYDVQQDDAZoYXN1cmEwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDLq41ddhw4SxTWbbCPk2QgziBSH6K5947roOjKVIH8hZSPjbKJVEzvymvEk8MxqHZAoFFtmE+I0oWXWErY9PDh4o8wy6bjMlbT9kS+19r5piAcNY+OF692NkGj7CR/J01yu/isLa4yuUJ2/FQF6CTVEz0Z9AoiSXfEYQLmvPPyaO+s7nIScEsHdMPxNxGgLL7RFnhZoeEAhHb6O06rY/EiQwpnXiEJH+bhuuLT0GHvq/9VGsZVM/4FsGwlta5pxUL+BjFGa7C+cVN3Mo8P2XqLD+gpnudtiPNAOJt4ygmEu7NgcZDQh5S7nA1xwxHZbjuP4syu/V05lMbbZ+IDPhh1AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAMcSKDvlwbbe5gVp8z4y3BM8b3Vs7DBzCH8tYJyQ0BtHBPdeLr3AXi81Mt22s1LiOfNtFJ4lS7/Vc+laispgKeau1uPOqoKT+EMQ5mWzFCT6oudkUBFIEMVFLSFGqqHANyQK1lulhsDa7EmEx8b4LO5XWLxL87DNeDgqDXn0Ymgq0XBifh6Jgx/VyzyunH6cuZKrm2vdgqA4BMMmWP7pakwAFHpTKY9yrxU8yZa9LIlONZreg/Ep86quVklnJwXdkXUXlMWC0QlrDIulgBts3GhZxk/AQCKd8RytUHWds7qyGdNPjLpy3dyB3Dq34PJbV+AI3CbvklEH8xnsktKSb9E="
        ],
        "x5t": "ukVmv2ZTBwSKZNGnmmESs18dOOM",
        "x5t#S256": "79kLTNOV8sLTmbvywLsGQPv8vSLnsOPO33xXVQ6KcEI"
    }`
    )
  )
  return jwt.verify(token, certString)
}

module.exports = {
  getUserIdFromTokenPayload,
  decodeToken
}
