using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/destroyUser")]
public class ActionDestroyUserController : ControllerBase
{
    private readonly ILogger<ActionRegisterController> _logger;

    public ActionDestroyUserController(ILogger<ActionRegisterController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionDestroyUser")]
    public async Task<IActionResult> Post([FromBody] DestroyUserRequest destroyUserRequest)
    {
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

        if (string.IsNullOrEmpty(token))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "You must be logged in to perform this action." });
        }

        if (destroyUserRequest.input == null || string.IsNullOrEmpty(destroyUserRequest.input.password))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "password is required." });
        }
        string password = destroyUserRequest.input.password;

        (string? userIdStr, _) = AuthCrypt.GetUserIdAndIatFromToken(token, jwtSecret);
        if (string.IsNullOrEmpty(userIdStr))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Invalid authentication token!" });
        }

        try
        {
            User user = await UserGraphQL.GetUserById(userIdStr);
            if (AuthCrypt.CheckPassword(password, user.password ?? ""))
            {
                // Clear any cached token auth responses
                await Cache.Instance.Del("auth/user/" + userIdStr);
                // TODO - must all delete all x-requested-role keys as well!

                // Delete the user
                await UserGraphQL.DeleteUser(user.id);
                return Ok(new SuccessResponse(true));
            }
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "password did not match!" });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = ex.Message });
        }
    }
}
