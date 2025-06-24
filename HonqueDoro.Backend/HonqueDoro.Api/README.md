# HonqueDoro Backend API

A C# Web API backend for the HonqueDoro Pomodoro Timer application, built with ASP.NET Core and Entity Framework Core.

## 🚀 Features

- **Timer Sessions Management**: Start, complete, and track Pomodoro sessions
- **Statistics & Analytics**: Comprehensive statistics including streaks, totals, and weekly data
- **Achievement System**: Track user milestones and accomplishments
- **User Settings**: Customizable timer durations and preferences
- **Dashboard Data**: Aggregated data for the dashboard view
- **CORS Support**: Configured for Angular frontend integration

## 📁 Project Structure

```
HonqueDoro.Api/
├── Controllers/          # API Controllers
│   ├── DashboardController.cs
│   ├── SessionsController.cs
│   ├── SettingsController.cs
│   └── StatisticsController.cs
├── Data/                 # Database Context & Seeding
│   ├── HonqueDoroContext.cs
│   └── SampleDataService.cs
├── DTOs/                 # Data Transfer Objects
│   ├── SessionDto.cs
│   └── StatisticsDto.cs
├── Models/              # Entity Models
│   ├── Achievement.cs
│   ├── PomodoroSession.cs
│   ├── UserSettings.cs
│   └── UserStatistics.cs
└── Program.cs           # Application Entry Point
```

## 🛠 API Endpoints

### Sessions
- `POST /api/sessions/start` - Start a new timer session
- `POST /api/sessions/complete` - Complete a session
- `GET /api/sessions/{id}` - Get session by ID
- `GET /api/sessions/recent` - Get recent sessions
- `GET /api/sessions/today` - Get today's sessions

### Dashboard
- `GET /api/dashboard` - Get complete dashboard data
- `GET /api/dashboard/today-stats` - Get today's statistics
- `GET /api/dashboard/weekly-goal` - Get weekly goal progress

### Statistics
- `GET /api/statistics` - Get complete statistics page data
- `GET /api/statistics/overall` - Get overall statistics
- `GET /api/statistics/weekly` - Get current week data
- `GET /api/statistics/achievements` - Get all achievements
- `GET /api/statistics/monthly/{year}/{month}` - Get monthly data

### Settings
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Create or update settings
- `PUT /api/settings` - Update settings
- `POST /api/settings/reset` - Reset to default settings
- `GET /api/settings/timer-config` - Get timer configuration
- `POST /api/settings/timer-config` - Update timer configuration

## 🗄 Database Models

### PomodoroSession
Represents individual timer sessions (work, short break, long break).

### UserStatistics
Daily statistics including completed sessions, work time, and streaks.

### Achievement
User achievements and milestones with progress tracking.

### UserSettings
User preferences for timer durations, notifications, and goals.

## 🔧 Configuration

### Database
- **Development**: Uses In-Memory database for easy testing
- **Production**: Configure SQL Server connection in `appsettings.json`

### CORS
Configured to allow requests from Angular development server (`http://localhost:4200`).

### Sample Data
The application automatically seeds sample data in development mode for testing.

## 🚀 Getting Started

1. **Prerequisites**
   - .NET 8.0 SDK
   - Visual Studio 2022 or VS Code

2. **Run the API**
   ```bash
   cd HonqueDoro.Backend/HonqueDoro.Api
   dotnet run
   ```

3. **Access Swagger UI**
   Navigate to `https://localhost:7001/swagger` to explore the API endpoints.

4. **Health Check**
   Visit `https://localhost:7001/health` to verify the API is running.

## 📊 Sample Data

The application includes sample data for:
- 7 days of session history
- User statistics and streaks
- Some unlocked achievements
- Default user settings

## 🔄 Integration with Angular Frontend

The API is designed to work seamlessly with the Angular HonqueDoro frontend:

1. **CORS Configuration**: Allows requests from `http://localhost:4200`
2. **DTO Structure**: Matches the expected data formats in Angular components
3. **Error Handling**: Proper HTTP status codes and error messages
4. **Data Validation**: Model validation with appropriate error responses

## 🛡 Security Considerations

For production deployment:
- Add authentication/authorization
- Implement rate limiting
- Configure HTTPS properly
- Use a persistent database (SQL Server, PostgreSQL, etc.)
- Add input validation and sanitization
- Implement proper logging and monitoring

## 📝 Future Enhancements

- User authentication and multi-user support
- Real-time session updates with SignalR
- Data export functionality
- Advanced analytics and reporting
- Team collaboration features
- Mobile API support 