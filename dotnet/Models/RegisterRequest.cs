namespace HasuraStarter;

public class RegisterRequest
{
    public RegisterRequestInput? input { get; set; }

}

public class RegisterRequestInput
{
    public string? email { get; set; }

    public string? password { get; set; }
}