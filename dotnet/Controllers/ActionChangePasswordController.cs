using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/changePassword")]
public class ActionChangePasswordController : ControllerBase
{
    private readonly ILogger<ActionRegisterController> _logger;

    public ActionChangePasswordController(ILogger<ActionRegisterController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionChangePassword")]
    public async Task<IActionResult> Post([FromBody] ChangePasswordRequest changePasswordRequest)
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

        if (changePasswordRequest.input == null || string.IsNullOrEmpty(changePasswordRequest.input.oldPassword))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "old_password is required." });
        }
        string oldPassword = changePasswordRequest.input.oldPassword;

        if (changePasswordRequest.input == null || string.IsNullOrEmpty(changePasswordRequest.input.newPassword))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "new_password is required." });
        }
        string newPassword = changePasswordRequest.input.newPassword;

        (string? userIdStr, _) = AuthCrypt.GetUserIdAndIatFromToken(token, jwtSecret);
        if (string.IsNullOrEmpty(userIdStr))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Invalid authentication token!" });
        }

        try
        {
            User user = await UserGraphQL.GetUserById(userIdStr);
            if (AuthCrypt.CheckPassword(oldPassword, user.password ?? ""))
            {
                // Clear any cached token auth responses
                await Cache.Instance.Del("auth/user/" + userIdStr);
                // TODO - must all delete all x-requested-role keys as well!

                // Update the user
                string newHashedPassword = AuthCrypt.HashPassword(newPassword);
                await UserGraphQL.ChangeUserPassword(user.id, newHashedPassword);
                return Ok(new ChangePasswordResponse(user.passwordAt ?? ""));
            }
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "old password did not match!" });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = ex.Message });
        }
    }
}
