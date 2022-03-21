namespace HasuraStarter;

using BCrypt.Net;
using JWT;
using JWT.Algorithms;
using JWT.Serializers;
using JWT.Exceptions;
using System.Text.Json;

public class AuthCrypt
{
    public static string HashPassword(string password)
    {
        return BCrypt.HashPassword(password, 10);
    }

    public static bool CheckPassword(string password, string hashedPassword)
    {
        return BCrypt.Verify(password, hashedPassword);
    }

    // https://github.com/jwt-dotnet/jwt
    public static string GenerateToken(int userId, string secret, long iat = 0)
    {
        if (iat == 0)
        {
            iat = DateTimeOffset.Now.ToUnixTimeSeconds();
        }
        var payload = new Dictionary<string, object>
        {
            { "x-hasura-allowed-roles", new string[] {"user"} },
            { "x-hasura-default-role", "user" },
            { "x-hasura-user-id", userId + "" },
            { "iat", iat },
            // { "exp", DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()}
        };

        IJwtAlgorithm algorithm = new HMACSHA256Algorithm();
        IJsonSerializer serializer = new JsonNetSerializer();
        IBase64UrlEncoder urlEncoder = new JwtBase64UrlEncoder();
        IJwtEncoder encoder = new JwtEncoder(algorithm, serializer, urlEncoder);

        var token = encoder.Encode(payload, secret);
        return token;
    }

    public static (string?, DateTime) GetUserIdAndIatFromToken(string token, string secret)
    {
        token = token.Replace("Bearer ", "");
        string decodedToken = DecodeToken(token, secret);
        if (decodedToken != String.Empty)
        {
            var decodedTokenJson = JsonDocument.Parse(decodedToken);
            string userIdStr = decodedTokenJson.RootElement.GetProperty("x-hasura-user-id").GetString() ?? "";

            Int32 iatTimestamp = decodedTokenJson.RootElement.GetProperty("iat").GetInt32();
            DateTime iat = DateTimeOffset.FromUnixTimeSeconds(iatTimestamp).UtcDateTime;

            if (userIdStr.Length > 0)
            {
                return (userIdStr, iat);
            }
        }
        return (null, DateTime.Now);
    }

    public static string DecodeToken(string token, string secret)
    {
        if ((token == null) || (token == string.Empty))
        {
            return string.Empty;
        }
        try
        {
            IJsonSerializer serializer = new JsonNetSerializer();
            IDateTimeProvider provider = new UtcDateTimeProvider();
            IJwtValidator validator = new JwtValidator(serializer, provider);
            IBase64UrlEncoder urlEncoder = new JwtBase64UrlEncoder();
            IJwtAlgorithm algorithm = new HMACSHA256Algorithm(); // symmetric
            IJwtDecoder decoder = new JwtDecoder(serializer, validator, urlEncoder, algorithm);

            var json = decoder.Decode(token, secret, verify: true);
            return json;
        }
        catch (TokenExpiredException)
        {
            Console.WriteLine("Token has expired");
        }
        catch (SignatureVerificationException)
        {
            Console.WriteLine("Token has invalid signature");
        }
        return string.Empty;
    }

    public static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}
