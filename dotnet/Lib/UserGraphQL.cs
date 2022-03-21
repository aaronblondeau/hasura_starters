using System.Text.Json;

namespace HasuraStarter;

public class UserGraphQL
{
    const string userFields = @"
        created_at
        email
        email_verification_token
        email_verified
        id
        password
        password_at
        password_reset_token
        updated_at";

    static HttpClient GetClient()
    {
        HttpClient hasuraClient = new HttpClient();
        hasuraClient.DefaultRequestHeaders.Add("x-hasura-admin-secret", Environment.GetEnvironmentVariable("HASURA_GRAPHQL_ADMIN_SECRET"));
        return hasuraClient;
    }

    public static async Task<User> GetUserById(string id)
    {
        return await GetUserById(int.Parse(id));
    }    

    static void CheckDocumentForErrors(JsonDocument? doc)
    {
        if (doc == null)
        {
            throw new ArgumentNullException("Empty response received from API!");
        }
        if (doc.RootElement.TryGetProperty("errors", out JsonElement errors))
        {
            string errorMessage = errors[0].GetProperty("message").GetString() ?? "Unknown error";
            throw new InvalidOperationException(errorMessage);
        }
    }

    public static async Task<User> GetUserById(int id)
    {
        HttpClient hasuraClient = GetClient();

        var userResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "GetUser",
            query = $@"query GetUser {{
                        users_by_pk(id: {id}) {{
                          {userFields}
                        }}
                    }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var userResponseBody = await userResponse.Content.ReadAsStringAsync();
        var user = JsonDocument.Parse(userResponseBody);

        CheckDocumentForErrors(user);

        User ? inflatedUser = JsonSerializer.Deserialize<User>(user.RootElement.GetProperty("data").GetProperty("users_by_pk"));
        if (inflatedUser == null)
        {
            throw new InvalidOperationException("Unable to de-serialize user!");
        }
        return inflatedUser;
    }

    public static async Task<User> GetUserByEmail(string email)
    {
        HttpClient hasuraClient = GetClient();

        var userResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "GetUserByEmail",
            query = $@"query GetUserByEmail {{
                users(where: {{email: {{_eq: ""{email}""}}}}) {{
                  {userFields}
                }}
            }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var userResponseBody = await userResponse.Content.ReadAsStringAsync();
        var user = JsonDocument.Parse(userResponseBody);

        CheckDocumentForErrors(user);

        User? inflatedUser = JsonSerializer.Deserialize<User>(user.RootElement.GetProperty("data").GetProperty("users")[0]);
        if (inflatedUser == null)
        {
            throw new InvalidOperationException("Unable to de-serialize user!");
        }
        return inflatedUser;
    }

    public static async Task<User> CreateUser(string email, string hashedPassword)
    {
        HttpClient hasuraClient = GetClient();

        var registerResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "CreateUser",
            query = $@"mutation CreateUser {{
              insert_users(objects: {{email: ""{email}"", password: ""{hashedPassword}""}}) {{
                returning {{
                    {userFields}
                }}
              }}
            }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var registerResponseBody = await registerResponse.Content.ReadAsStringAsync();
        var register = JsonDocument.Parse(registerResponseBody);

        CheckDocumentForErrors(register);

        User? inflatedUser = JsonSerializer.Deserialize<User>(register.RootElement.GetProperty("data").GetProperty("insert_users").GetProperty("returning")[0]);
        if (inflatedUser == null)
        {
            throw new InvalidOperationException("Unable to de-serialize user!");
        }
        return inflatedUser;
    }

    public static async Task<User> ChangeUserPassword(int id, string newHashedPassword)
    {
        HttpClient hasuraClient = GetClient();

        // Update the user's password
        var updateResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "UpdatePassword",
            query = $@"mutation UpdatePassword {{
              update_users_by_pk(pk_columns: {{id: {id}}}, _set: {{password: ""{newHashedPassword}"", password_reset_token: null, password_at: ""now()""}}) {{
                {userFields}
              }}
            }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var updateResponseBody = await updateResponse.Content.ReadAsStringAsync();
        var update = JsonDocument.Parse(updateResponseBody);

        CheckDocumentForErrors(update);

        User? inflatedUser = JsonSerializer.Deserialize<User>(update.RootElement.GetProperty("data").GetProperty("update_users_by_pk"));
        if (inflatedUser == null)
        {
            throw new InvalidOperationException("Unable to de-serialize user!");
        }
        return inflatedUser;
    }

    public static async Task DeleteUser(int id)
    {
        HttpClient hasuraClient = GetClient();

        // Destroy the user
        var deleteResponse = await hasuraClient.PostAsync((Environment.GetEnvironmentVariable("HASURA_BASE_URL") ?? "http://localhost:8000") + "/v1/graphql", new StringContent(JsonSerializer.Serialize(new
        {
            operationName = "DeleteUser",
            query = $@"mutation DeleteUser {{
              delete_users_by_pk(id: {id}) {{
                  id
              }}
            }}",
            // variables = null
        }), System.Text.Encoding.UTF8, "application/json"));
        var deleteResponseBody = await deleteResponse.Content.ReadAsStringAsync();
        var delete = JsonDocument.Parse(deleteResponseBody);

        CheckDocumentForErrors(delete);
    }
}