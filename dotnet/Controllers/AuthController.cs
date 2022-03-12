using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

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

    private AuthResponse Authenticate(AuthRequest? authBody) {
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

        // Console.WriteLine("~~ Got token " + token);

        // return new AuthResponse("user", 1.ToString());

        return new AuthResponse("public", "");
    }

    [HttpGet(Name = "GetAuth")]
    public AuthResponse Get()
    {
        return Authenticate(null);
    }

    [HttpPost(Name = "PostAuth")]
    public AuthResponse Post([FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AuthRequest? authRequest)
    {
        return Authenticate(authRequest);
    }
}
