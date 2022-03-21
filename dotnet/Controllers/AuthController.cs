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

        // This action looks in multiple places for the token so that we can authenticate
        // via methods other than just a Hasura action:

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
                // TODO - if using role requests (IMPORTANT - see also cache clear in changePassword action if implemented!)
                // if (Request.Headers.TryGetValue("x-requested-role", out var role))
                // {
                //     cacheKey = cacheKey + ":" + role;
                // }

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
                    if (cachedResponse != null)
                    {
                        return Ok(cachedResponse);
                    }
                }

                // Load user and ensure that password has not changed since the token was generated
                try
                {
                    User user = await UserGraphQL.GetUserById(userId);

                    DateTime passwordAt = DateTime.Parse(user.passwordAt ?? "").ToUniversalTime();
                    if (tokenIat < passwordAt.AddSeconds(-10))
                    {
                        return StatusCode(StatusCodes.Status401Unauthorized, new { message = "Token has been invalidated!" });
                    }

                    AuthResponse response = new AuthResponse("user", userId + "");
                    if (useCache)
                    {
                        await Cache.Instance.Set(cacheKey, JsonSerializer.Serialize<AuthResponse>(response));
                    }
                    return Ok(response);

                } catch (Exception ex)
                {
                    return StatusCode(StatusCodes.Status401Unauthorized, new { message = ex.Message });
                }
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
