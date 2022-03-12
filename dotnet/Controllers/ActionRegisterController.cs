using Microsoft.AspNetCore.Mvc;

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
    public RegisterResponse Post([FromBody] RegisterRequest registerRequest)
    {
        if (System.Environment.GetEnvironmentVariable("JWT_SECRET") == null) {
            throw new ArgumentException("Authentication action is not properly configured!");
        }

        if (registerRequest.input == null || registerRequest.input.email == null) {
            throw new ArgumentException("email is required.");
        }

        return new RegisterResponse("1", registerRequest.input.email);
    }
}
