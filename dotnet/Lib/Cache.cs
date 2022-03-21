namespace HasuraStarter;

using StackExchange.Redis;

public sealed class Cache
{
    // Singleton!
    private static readonly Lazy<Cache> lazy =
        new Lazy<Cache>(() => new Cache());

    public static Cache Instance { get { return lazy.Value; } }

    ConnectionMultiplexer redis;
    IDatabase db;


    private Cache()
    {
        string host = Environment.GetEnvironmentVariable("REDIS_HOST") ?? "localhost";
        string port = Environment.GetEnvironmentVariable("REDIS_PORT") ?? "6379";
        string password = Environment.GetEnvironmentVariable("REDIS_PASSWORD") ?? "";

        var options = ConfigurationOptions.Parse(host + ":" + port);
        if (!string.IsNullOrEmpty(password)) {
            options.Password = password;
        }

        Console.WriteLine("~~ Connecting to : " + host + ":" + port);

        redis = ConnectionMultiplexer.Connect(options);
        db = redis.GetDatabase(Int32.Parse(Environment.GetEnvironmentVariable("CACHE_REDIS_DB") ?? "1"));
    }

    public void Connect()
    {
        // Nothing to do here...
        Console.WriteLine("~~ Cache connect");
    }

    public async Task Set(string key, string value)
    {
        // Expire after 1800 seconds
        await db.StringSetAsync(key, value, TimeSpan.FromSeconds(1800));
    }

    public async Task<string> Get(string key)
    {
        string value = await db.StringGetAsync(key);
        return value;
    }

    public async Task Del(string key)
    {
        await db.KeyDeleteAsync(key);
    }
}