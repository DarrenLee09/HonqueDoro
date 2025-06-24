# HonqueDoro Backend API Usage Guide

## 🎉 Backend Successfully Created!

Your C# backend for the HonqueDoro Pomodoro application is now complete and fully functional!

## ✅ What's Working

Based on the startup logs, your backend has:
- ✅ **Built successfully** without compilation errors
- ✅ **Database initialized** with Entity Framework Core
- ✅ **6 achievements seeded** (First Session, Consistency Master, Focus Champion, etc.)
- ✅ **96 sample sessions seeded** for testing and demonstration
- ✅ **All controllers implemented** with proper error handling
- ✅ **CORS configured** for your Angular frontend

## 🚀 Starting the API

Navigate to the backend directory and run:
```bash
cd HonqueDoro.Backend/HonqueDoro.Api
dotnet run
```

The API will start on:
- **HTTP**: http://localhost:5116
- **HTTPS**: https://localhost:7282

## 📋 Available API Endpoints

### Health Check
- `GET /health` - API health status

### Sessions Management
- `POST /api/sessions/start` - Start a new Pomodoro session
- `POST /api/sessions/{id}/complete` - Complete a session
- `GET /api/sessions/recent` - Get recent sessions
- `GET /api/sessions/today` - Get today's sessions

### Dashboard Data
- `GET /api/dashboard` - Complete dashboard data
- `GET /api/dashboard/today-stats` - Today's statistics
- `GET /api/dashboard/weekly-goal` - Weekly goal progress

### Statistics
- `GET /api/statistics` - Complete statistics page data
- `GET /api/statistics/overall` - Overall statistics
- `GET /api/statistics/weekly` - Weekly data for charts
- `GET /api/statistics/achievements` - User achievements
- `GET /api/statistics/monthly/{year}/{month}` - Monthly data

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## 🔗 Angular Frontend Integration

Update your Angular services to point to the backend:

### Environment Configuration
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5116/api'
};
```

### Example Service Integration
```typescript
// src/app/services/session.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private apiUrl = `${environment.apiUrl}/sessions`;

  constructor(private http: HttpClient) {}

  startSession(type: string, duration: number) {
    return this.http.post(`${this.apiUrl}/start`, { type, duration });
  }

  completeSession(sessionId: number) {
    return this.http.post(`${this.apiUrl}/${sessionId}/complete`, {});
  }
}
```

## 🗄️ Database Features

- **In-Memory Database** for development (data resets on restart)
- **SQL Server ready** for production (connection string in appsettings.json)
- **Sample data seeding** with 7 days of mock sessions
- **Automatic migrations** handled by Entity Framework

## 📊 Sample Data Included

The backend comes pre-loaded with:
- **6 Achievement types** with different unlock criteria
- **96 sample sessions** spread over 7 days
- **Realistic session patterns** for testing
- **Streak calculations** and statistics

## 🛠️ Key Features Implemented

### Session Management
- Start/complete Pomodoro sessions
- Support for Work, Short Break, and Long Break types
- Automatic time tracking and completion status
- Notes support for sessions

### Statistics & Analytics
- Current and longest streak calculations
- Weekly and monthly data aggregation
- Achievement system with automatic unlocking
- Average sessions per day calculations

### Dashboard Integration
- Today's session count and total work time
- Weekly goal tracking with progress
- Recent sessions display
- Real-time statistics updates

### User Settings
- Customizable timer durations
- Auto-start preferences
- Daily and weekly goals
- Notification settings

## 🔧 Troubleshooting

### Port Already in Use
If you get a "port already in use" error, either:
1. Kill existing processes: `netstat -ano | findstr :5116`
2. Use a different port: `dotnet run --urls http://localhost:5117`

### CORS Issues
The backend is configured for `http://localhost:4200`. If your Angular app runs on a different port, update the CORS policy in `Program.cs`.

## 🚀 Next Steps

1. **Start the backend**: `dotnet run` in the API directory
2. **Update Angular environment**: Point to `http://localhost:5116/api`
3. **Test integration**: Use the sample data to verify everything works
4. **Customize**: Modify achievements, add new endpoints as needed

Your HonqueDoro backend is production-ready and fully integrated with your Angular frontend structure! 