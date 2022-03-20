using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/auth")]
public class AuthController : ControllerBase
{
    private readonly ILogger<AuthController> _logger;

    public AuthController(ILogger<AuthController> logger)
    {
        _logger = logger;
    }

    private async Task<IActionResult> Authenticate(AuthRequest? authBody) {
        string jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? string.Empty;
        if (jwtSecret == string.Empty)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Authentication action is not properly configured!" });
        }

        string token = String.Empty;

        // Look in Body
        if (authBody is not null && authBody.token is not null) {
            token = authBody.token;
        }

        // Look in Query
        if (token == String.Empty) {
            if(Request.Query.TryGetValue("token", out var authToken)){
                token = authToken;
            }
        }
        
        // Look in Authorization header
        if (token == String.Empty) {
            if(Request.Headers.TryGetValue("Authorization", out var authorization)){
                string authHeader = authorization;
                token = authHeader.Replace("Bearer ", "");
            }
        }

        (string? userIdStr, DateTime tokenIat) = AuthCrypt.GetUserIdAndIatFromToken(token, jwtSecret);
        if (userIdStr != null)
        {
            if (Int32.TryParse(userIdStr, out int userId))
            {
                string cacheKey = "auth/user/" + userIdStr;
                if (Request.Headers.TryGetValue("x-requested-role", out var role))
                {
                    cacheKey = cacheKey + ":" + role;
                }

                bool useCache = true;
                if (Environment.GetEnvironmentVariable("DISABLE_AUTH_CACHE") == "yes")
                {
                    useCache = false;
                }
                string cached = String.Empty;
                if (useCache)
                {
                    cached = await Cache.Instance.Get(cacheKey);
                }
                if (!string.IsNullOrEmpty(cached))
                {
                    AuthResponse? cachedResponse = JsonSerializer.Deserialize<AuthResponse>(cached);
                    // TODO convert to AuthResponse and return it
                    if (cachedResponse != null)
                    {
                        return Ok(cachedResponse);
                    }
                }

                // Load user and ensure that password has not changed since the token was generated

                HttpClient hasuraClient = new HttpClient();
                hasuraClient.DefaultRequestHeaders.Add("x-hasura-admin-secret", Environment.GetEnvironmentVariable("HASURA_GRAPHQL_ADMIN_SECRET"));

                var userResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
                {
                    operationName = "GetUser",
                    query = $@"query GetUser {{
                        users_by_pk(id: {userId}) {{
                          id
                          password_at
                        }}
                    }}",
                    // variables = null
                }), System.Text.Encoding.UTF8, "application/json"));
                var userResponseBody = await userResponse.Content.ReadAsStringAsync();
                var user = JsonDocument.Parse(userResponseBody);

                if (user.RootElement.TryGetProperty("errors", out JsonElement errors))
                {
                    string errorMessage = errors[0].GetProperty("message").GetString() ?? "Unknown error";
                    return StatusCode(StatusCodes.Status400BadRequest, new { message = errorMessage });
                }

                string passwordAtStr = user.RootElement.GetProperty("data").GetProperty("users_by_pk").GetProperty("password_at").GetString() ?? "";

                DateTime passwordAt = DateTime.Parse(passwordAtStr).ToUniversalTime();

                if (passwordAt > tokenIat)
                {
                    return StatusCode(StatusCodes.Status400BadRequest, new { message = "Token has been invalidated!" });
                }

                AuthResponse response = new AuthResponse("user", userId + "");
                if (useCache)
                {
                    await Cache.Instance.Set(cacheKey, JsonSerializer.Serialize<AuthResponse>(response));
                }
                return Ok(response);
            }
        }
        return Ok(new AuthResponse("public", ""));
    }

    [HttpGet(Name = "GetAuth")]
    public Task<IActionResult> Get()
    {
        return Authenticate(null);
    }

    [HttpPost(Name = "PostAuth")]
    public Task<IActionResult> Post([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AuthRequest? authRequest)
    {
        return Authenticate(authRequest);
    }
}
