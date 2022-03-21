namespace HasuraStarter;

public class DestroyUserRequest
{
    public DestroyUserRequestInput? input { get; set; }

}

public class DestroyUserRequestInput
{
    public string? password { get; set; }
}