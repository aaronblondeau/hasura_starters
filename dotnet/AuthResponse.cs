namespace HasuraStarter;
using System.Text.Json.Serialization;

public class AuthResponse
{
     [JsonPropertyName("x-hasura-role")]
    public string xHasuraRole { get; set; }

    [JsonPropertyName("x-hasura-user-id")]
    public string xHasuraUserId { get; set; }

    public AuthResponse(string role, string userId) {
        xHasuraRole = role;
        xHasuraUserId = userId;
    }
}
