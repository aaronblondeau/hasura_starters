namespace HasuraStarter;
using System.Text.Json.Serialization;

public class WhoamiResponse
{
    public string id { get; set; }

    public WhoamiResponse(string id) {
        this.id = id;
    }
}
