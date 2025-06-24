# HonqueDoro Python Backend

A simple Flask-based backend for the HonqueDoro Pomodoro timer application.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the backend:
```bash
python app.py
```

The server will start on `http://localhost:5116`

## API Endpoints

### Sessions
- `POST /api/sessions/start` - Start a new session
- `POST /api/sessions/pause/{session_id}` - Pause a session
- `POST /api/sessions/resume/{session_id}` - Resume a session
- `POST /api/sessions/complete/{session_id}` - Complete a session
- `POST /api/sessions/skip/{session_id}` - Skip a session
- `DELETE /api/sessions/cancel/{session_id}` - Cancel a session
- `GET /api/sessions/active` - Get active session
- `GET /api/sessions/{session_id}` - Get specific session
- `GET /api/sessions/recent` - Get recent sessions
- `GET /api/sessions/today` - Get today's sessions

### Statistics
- `GET /api/statistics` - Get user statistics

### Health Check
- `GET /health` - Health check endpoint

## Features

- In-memory session storage (resets on server restart)
- Real-time session tracking
- Automatic session completion
- Statistics tracking
- CORS enabled for Angular frontend 