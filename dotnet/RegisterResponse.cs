namespace HasuraStarter;

public class RegisterResponse
{
    public string id { get; set; }
    public string token { get; set; }

    public RegisterResponse(string id, string token) {
        this.id = id;
        this.token = token;
    }
}
