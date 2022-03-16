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

    private IActionResult Authenticate(AuthRequest? authBody) {
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

        string? userIdStr = AuthCrypt.GetUserIdFromToken(token, jwtSecret);
        if (userIdStr != null)
        {
            if (Int32.TryParse(userIdStr, out int userId))
            {
                // TODO - load user and check for changed password

                return Ok(new AuthResponse("user", userId + ""));
            }
        }
        return Ok(new AuthResponse("public", ""));
    }

    [HttpGet(Name = "GetAuth")]
    public IActionResult Get()
    {
        return Authenticate(null);
    }

    [HttpPost(Name = "PostAuth")]
    public IActionResult Post([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AuthRequest? authRequest)
    {
        return Authenticate(authRequest);
    }
}
