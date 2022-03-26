using HasuraStarter;

var builder = WebApplication.CreateBuilder(args);

var root = Directory.GetCurrentDirectory();
var dotenv = Path.Combine(root, ".env");
HasuraStarter.DotEnv.Load(dotenv);

// Add services to the container.

builder.Services.AddRazorPages();

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// https://stackoverflow.com/questions/69532898/asp-net-core-6-0-kestrel-server-is-not-working
builder.WebHost.ConfigureKestrel(options =>
{
    // TODO this only seems to work with "dotnet watch", and not "dotnet run"
    // options.ListenLocalhost(Int32.Parse(System.Environment.GetEnvironmentVariable("PORT") ?? "3000"));
    // TODO this is needed for Hasura to be able to call endpoint from docker
    options.ListenAnyIP(Int32.Parse(System.Environment.GetEnvironmentVariable("PORT") ?? "3000")); // to listen for incoming http connection on port 5001
    // options.ListenAnyIP(7001, configure => configure.UseHttps()); // to listen for incoming https connection on port 7001
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if(Environment.GetEnvironmentVariable("USE_HTTPS") == "yes") {
    app.UseHttpsRedirection();
}

app.UseAuthorization();

app.MapControllers();

Console.WriteLine("~~ Connecting to cache...");
Cache.Instance.Connect();
JobQueue.Instance.StartWork();

app.MapRazorPages();

app.Run();
