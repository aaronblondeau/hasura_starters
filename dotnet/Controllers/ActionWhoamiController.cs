using Microsoft.AspNetCore.Mvc;
using MassTransit;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/whoami")]
public class ActionWhoamiController : ControllerBase
{
    private readonly ILogger<ActionWhoamiController> _logger;
    readonly IBus _bus;

    public ActionWhoamiController(ILogger<ActionWhoamiController> logger, IBus bus)
    {
        _logger = logger;
        _bus = bus;
    }

    [HttpPost(Name = "ActionWhoami")]
    public async Task<IActionResult> Post()
    {
        Console.WriteLine("~~dbg HERE X.1 " + _bus);
        await _bus.Publish(new SendPasswordResetEmail { userId = 99 });
        Console.WriteLine("~~dbg HERE X.2");
        // HasuraStarter.SendPasswordResetEmailJobConsumer.CreateJob(99);

        string jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? string.Empty;
        if (jwtSecret == string.Empty)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Authentication action is not properly configured!" });
        }

        string token = string.Empty;
        if (Request.Headers.TryGetValue("Authorization", out var authorization))
        {
            string authHeader = authorization;
            token = authHeader.Replace("Bearer ", "");
        }

        (string? userIdStr, _) = AuthCrypt.GetUserIdAndIatFromToken(token, jwtSecret);
        if (userIdStr != null)
        {
            return Ok(new WhoamiResponse(userIdStr));
        }

        return StatusCode(StatusCodes.Status400BadRequest, new { message = "Invalid authentication token!" });
    }
}
