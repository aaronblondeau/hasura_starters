namespace HasuraStarter;

using RabbitMQ.Client;
using System.Text;
using RabbitMQ.Client.Events;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Runtime.Serialization;

// https://www.rabbitmq.com/tutorials/tutorial-two-dotnet.html

public enum JobType
{
    [EnumMember(Value = "PasswordResetEmail")]
    PasswordResetEmail,

    [EnumMember(Value = "VerifyEmail")]
    VerifyEmail
}

public class Job
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public JobType jobType { get; set; }

    public JsonDocument payload { get; set; }
}

public class PasswordResetEmailJob
{
    public int userId { get; set; }
}

public class VerifyEmailJob
{
    public int userId { get; set; }
}


public sealed class JobQueue
{
    // Singleton!
    private static readonly Lazy<JobQueue> lazy =
        new Lazy<JobQueue>(() => new JobQueue());

    public static JobQueue Instance { get { return lazy.Value; } }

    IConnection connection;
    IModel channel;
    AsyncEventingBasicConsumer consumer;

    private JobQueue()
    {
        var factory = new ConnectionFactory() { HostName = "localhost", UserName = "admin", Password = "admin", DispatchConsumersAsync = true };
        connection = factory.CreateConnection();
        channel = connection.CreateModel();

        channel.QueueDeclare(queue: "task_queue",
                                 durable: true,
                                 exclusive: false,
                                 autoDelete: false,
                                 arguments: null);

        channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
    }

    public void StartWork()
    {
        Console.WriteLine(" [*] Waiting for messages.");

        this.consumer = new AsyncEventingBasicConsumer(channel);

        this.consumer.Received += async (sender, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            Console.WriteLine(" [x] Work Received {0}", message);

            var job = JsonSerializer.Deserialize<Job>(message);
            if (job != null)
            {
                if (job.jobType == JobType.PasswordResetEmail)
                {
                    var payload = JsonSerializer.Deserialize<PasswordResetEmailJob>(job.payload);
                    if (payload != null)
                    {
                        var user = await UserGraphQL.GetUserById(payload.userId);

                        // Reset email link looks like : http://localhost:3000/reset_password/1b70f2c9-6c08-43c3-95df-823089423b3d
                        Console.WriteLine($"TODO send email to {user.email} with password reset token {user.passwordResetToken}");
                    }
                }
                else if (job.jobType == JobType.VerifyEmail)
                {
                    var payload = JsonSerializer.Deserialize<PasswordResetEmailJob>(job.payload);
                    if (payload != null)
                    {
                        var user = await UserGraphQL.GetUserById(payload.userId);

                        // Reset email link looks like : http://localhost:3000/verify/1b70f2c9-6c08-43c3-95df-823089423b3d
                        Console.WriteLine($"TODO send email to {user.email} with verification token {user.emailVerificationToken}");
                    }
                }
            }

            Console.WriteLine(" [x] Done");

            // Note: it is possible to access the channel via
            //       ((EventingBasicConsumer)sender).Model here
            channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
        };
        channel.BasicConsume(queue: "task_queue",
                                 autoAck: false,
                                 consumer: consumer);
    }

    public void TriggerSendPasswordResetEmail(int userId)
    {
        var job = new Job() { jobType = JobType.PasswordResetEmail };
        job.payload = JsonSerializer.SerializeToDocument(new PasswordResetEmailJob() { userId = userId });
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(job));

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;

        channel.BasicPublish(exchange: "",
                             routingKey: "task_queue",
                             basicProperties: properties,
                             body: body);
        Console.WriteLine(" [x] Trigger Sent {0}", body);
    }

    public void TriggerVerifyEmail(int userId)
    {
        var job = new Job() { jobType = JobType.VerifyEmail };
        job.payload = JsonSerializer.SerializeToDocument(new VerifyEmailJob() { userId = userId });
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(job));

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;

        channel.BasicPublish(exchange: "",
                             routingKey: "task_queue",
                             basicProperties: properties,
                             body: body);
        Console.WriteLine(" [x] Trigger Sent {0}", body);
    }

    ~JobQueue()
    {
        if (connection != null)
        {
            connection.Dispose();
        }
        if (channel != null)
        {
            channel.Dispose();
        }
    }
}
