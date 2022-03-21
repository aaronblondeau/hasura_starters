using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/login")]
public class ActionLoginController : ControllerBase
{
    private readonly ILogger<ActionRegisterController> _logger;

    public ActionLoginController(ILogger<ActionRegisterController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionLogin")]
    public async Task<IActionResult> Post([FromBody] RegisterRequest registerRequest)
    {
        string jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? string.Empty;
        if (jwtSecret == string.Empty)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Authentication action is not properly configured!" });
        }

        if (registerRequest.input == null || registerRequest.input.email == null)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is required." });
        }
        if (!AuthCrypt.IsValidEmail(registerRequest.input.email))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is invalid." });
        }

        if (registerRequest.input == null || registerRequest.input.password == null)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Password is required." });
        }

        string email = registerRequest.input.email.ToLower();
        string password = registerRequest.input.password;

        try
        {
            User user = await UserGraphQL.GetUserByEmail(email);
            if (AuthCrypt.CheckPassword(password, user.password ?? ""))
            {
                string token = AuthCrypt.GenerateToken(user.id, jwtSecret);
                return Ok(new LoginRegisterResponse(user.id, token));
            }
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "email or password did not match!" });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status401Unauthorized, new { message = ex.Message });
        }
    }
}
