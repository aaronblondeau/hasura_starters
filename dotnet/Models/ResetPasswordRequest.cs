namespace HasuraStarter;

public class ResetPasswordRequest
{
    public ResetPasswordRequestInput? input { get; set; }

}

public class ResetPasswordRequestInput
{
    public string? email { get; set; }
}