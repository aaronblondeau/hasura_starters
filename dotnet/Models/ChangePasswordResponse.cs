namespace HasuraStarter;
using System.Text.Json.Serialization;

public class ChangePasswordResponse
{
    [JsonPropertyName("password_at")]
    public string passwordAt { get; set; }

    public ChangePasswordResponse(string passwordAt)
    {
        this.passwordAt = passwordAt;
    }
}
