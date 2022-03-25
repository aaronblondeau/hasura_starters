namespace HasuraStarter;

using RabbitMQ.Client;
using System.Text;
using RabbitMQ.Client.Events;

// https://www.rabbitmq.com/tutorials/tutorial-two-dotnet.html

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

            int dots = message.Split('.').Length - 1;
            await Task.Delay(1250);

            Console.WriteLine(" [x] Done");

            // Note: it is possible to access the channel via
            //       ((EventingBasicConsumer)sender).Model here
            channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
        };
        channel.BasicConsume(queue: "task_queue",
                                 autoAck: false,
                                 consumer: consumer);
    }

    public void Trigger(string message)
    {
        var body = Encoding.UTF8.GetBytes(message);

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;

        channel.BasicPublish(exchange: "",
                             routingKey: "task_queue",
                             basicProperties: properties,
                             body: body);
        Console.WriteLine(" [x] Trigger Sent {0}", message);
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
