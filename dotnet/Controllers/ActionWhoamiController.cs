using Microsoft.AspNetCore.Mvc;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/whoami")]
public class ActionWhoamiController : ControllerBase
{
    private readonly ILogger<ActionWhoamiController> _logger;

    public ActionWhoamiController(ILogger<ActionWhoamiController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionWhoami")]
    public IActionResult Post()
    {
        JobQueue.Instance.Trigger("Whoami Called!");

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
