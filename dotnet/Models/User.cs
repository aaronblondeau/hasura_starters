namespace HasuraStarter;
using System.Text.Json.Serialization;

public class User
{
    public int id { get; set; }

    public string? email { get; set; }

    public string? password { get; set; }

    [JsonPropertyName("password_at")]
    public string? passwordAt { get; set; }

    [JsonPropertyName("email_verification_token")]
    public string? emailVerificationToken { get; set; }

    [JsonPropertyName("password_reset_token")]
    public string? passwordResetToken { get; set; }

    [JsonPropertyName("created_at")]
    public string? createdAt { get; set; }

    [JsonPropertyName("updated_at")]
    public string? updatedAt { get; set; }

    public bool emailVerified { get; set; }
}
