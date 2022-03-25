# https://codeburst.io/get-started-with-rabbitmq-2-consume-messages-using-hosted-service-e7e6a20b15a6
# https://docs.microsoft.com/en-us/dotnet/core/docker/build-container?tabs=windows

# https://hub.docker.com/_/microsoft-dotnet-aspnet
# https://hub.docker.com/_/microsoft-dotnet-sdk

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build

WORKDIR /app
COPY ./*.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/core/aspnet:6.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
ENTRYPOINT ["dotnet", "hasura_starter.dll"]
