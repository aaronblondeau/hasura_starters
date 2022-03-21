namespace HasuraStarter;
using System.Text.Json.Serialization;

public class ChangePasswordRequest
{
    public ChangePasswordRequestInput? input { get; set; }
}

public class ChangePasswordRequestInput
{
    [JsonPropertyName("old_password")]
    public string? oldPassword { get; set; }

    [JsonPropertyName("new_password")]
    public string? newPassword { get; set; }
}