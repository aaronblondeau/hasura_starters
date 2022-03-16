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

        HttpClient hasuraClient = new HttpClient();
        hasuraClient.DefaultRequestHeaders.Add("x-hasura-admin-secret", Environment.GetEnvironmentVariable("HASURA_GRAPHQL_ADMIN_SECRET"));

        var userResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "GetUserByEmail",
            query = $@"query GetUserByEmail {{
                users(where: {{email: {{_eq: ""{email}""}}}}) {{
                  id
                  password
                }}
            }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var userResponseBody = await userResponse.Content.ReadAsStringAsync();
        var user = JsonDocument.Parse(userResponseBody);

        if (user.RootElement.TryGetProperty("errors", out JsonElement errors))
        {
            string errorMessage = errors[0].GetProperty("message").GetString() ?? "Unknown error";
            return StatusCode(StatusCodes.Status400BadRequest, new { message = errorMessage });
        }

        int id = user.RootElement.GetProperty("data").GetProperty("users")[0].GetProperty("id").GetInt32();
        string hashedPassword = user.RootElement.GetProperty("data").GetProperty("users")[0].GetProperty("password").GetString() ?? "";

        if (AuthCrypt.CheckPassword(password, hashedPassword))
        {
            string token = AuthCrypt.GenerateToken(id, jwtSecret);
            return Ok(new LoginRegisterResponse(id, token));
        }

        return StatusCode(StatusCodes.Status400BadRequest, new { message = "email or password did not match!" });
    }
}
