# Use the official .NET 6 SDK image as a build environment
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build-env
WORKDIR /app

# Copy the csproj and restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy the rest of the code and build the release
COPY . ./
RUN dotnet publish -c Release -o out

# Use the official .NET 6 ASP.NET Core runtime image for the final container
FROM mcr.microsoft.com/dotnet/aspnet:6.0
WORKDIR /app
COPY --from=build-env /app/out .

# Command to run the application
ENTRYPOINT ["dotnet", "WeatherApp.Api.dll"]
