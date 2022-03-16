namespace HasuraStarter;

public class LoginRegisterResponse
{
    public int id { get; set; }
    public string token { get; set; }

    public LoginRegisterResponse(int id, string token) {
        this.id = id;
        this.token = token;
    }
}
