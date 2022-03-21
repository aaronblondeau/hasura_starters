namespace HasuraStarter;
using System.Text.Json.Serialization;

public class SuccessResponse
{
    public bool success { get; set; }

    public SuccessResponse(bool status)
    {
        success = status;
    }
}
