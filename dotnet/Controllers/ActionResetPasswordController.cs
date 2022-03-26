using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/resetPassword")]
public class ActionResetPasswordController : ControllerBase
{
    private readonly ILogger<ActionRegisterController> _logger;

    public ActionResetPasswordController(ILogger<ActionRegisterController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionResetPassword")]
    public async Task<IActionResult> Post([FromBody] ResetPasswordRequest resetPasswordRequest)
    {
        if (resetPasswordRequest.input == null || string.IsNullOrEmpty(resetPasswordRequest.input.email))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is required." });
        }
        if (!AuthCrypt.IsValidEmail(resetPasswordRequest.input.email))
        {
            return StatusCode(StatusCodes.Status400BadRequest, new { message = "Email is invalid." });
        }

        string email = resetPasswordRequest.input.email.ToLower();

        try
        {
            var user = await UserGraphQL.GetUserByEmail(email);
            user = await UserGraphQL.UpdatePasswordResetToken(user.id);
            JobQueue.Instance.TriggerSendPasswordResetEmail(user.id);
            return Ok(new SuccessResponse(true));
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status401Unauthorized, new { message = ex.Message });
        }
    }
}
