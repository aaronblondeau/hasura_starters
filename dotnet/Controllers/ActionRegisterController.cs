using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/register")]
public class ActionRegisterController : ControllerBase
{
    private readonly ILogger<ActionRegisterController> _logger;

    public ActionRegisterController(ILogger<ActionRegisterController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionRegister")]
    public async Task<IActionResult> Post([FromBody] RegisterRequest registerRequest)
    {
        string jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? string.Empty;
        if (jwtSecret == string.Empty) {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Authentication action is not properly configured!" });
        }

        if (registerRequest.input == null || string.IsNullOrEmpty(registerRequest.input.email)) {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is required." });
        }
        if (!AuthCrypt.IsValidEmail(registerRequest.input.email))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is invalid." });
        }

        if (registerRequest.input == null || string.IsNullOrEmpty(registerRequest.input.password))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Password is required." });
        }
        if (registerRequest.input.password.Length < 5)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Password must be at least 5 characters long." });
        }

        string email = registerRequest.input.email.ToLower();
        string password = registerRequest.input.password;
        string hashedPassword = AuthCrypt.HashPassword(password);

        try
        {
            User user = await UserGraphQL.CreateUser(email, hashedPassword);
            // Make sure iat in token matches passwordAt so that timing issues don't break this initial token:
            string token = AuthCrypt.GenerateToken(user.id, jwtSecret, DateTimeOffset.Parse(user.passwordAt ?? "").ToUnixTimeSeconds());
            return Ok(new LoginRegisterResponse(user.id, token));
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status401Unauthorized, new { message = ex.Message });
        }
    }
}
