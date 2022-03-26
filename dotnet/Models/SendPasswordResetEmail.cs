using MassTransit;

namespace HasuraStarter;

public class SendPasswordResetEmail
{
    public int userId { get; set; }
}

public class SendPasswordResetEmailJobConsumer :
            IConsumer<SendPasswordResetEmail>
{
    readonly ILogger<SendPasswordResetEmailJobConsumer> _logger;

    public SendPasswordResetEmailJobConsumer(ILogger<SendPasswordResetEmailJobConsumer> logger)
    {
        _logger = logger;
    }


    public Task Consume(ConsumeContext<SendPasswordResetEmail> context)
    {
        _logger.LogInformation("Would send password reset email to user " + context.Message.userId);
        // simulate converting the video
        //await Task.Delay(TimeSpan.FromSeconds(5));
        return Task.CompletedTask;
    }
}
