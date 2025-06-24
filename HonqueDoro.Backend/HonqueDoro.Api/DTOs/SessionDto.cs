using HonqueDoro.Api.Models;

namespace HonqueDoro.Api.DTOs
{
    public class SessionDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public int Duration { get; set; }
        public DateTime CompletedAt { get; set; }
        public bool IsCompleted { get; set; }
        public string? Notes { get; set; }
        
        // Enhanced timer properties
        public string Status { get; set; } = string.Empty;
        public int RemainingSeconds { get; set; }
        public int ElapsedSeconds { get; set; }
        public DateTime? EstimatedEndTime { get; set; }
        public double ProgressPercentage { get; set; }
        public DateTime? LastUpdated { get; set; }
    }

    public class CreateSessionDto
    {
        public SessionType Type { get; set; }
        public int DurationMinutes { get; set; }
        public string? Notes { get; set; }
    }

    public class CompleteSessionDto
    {
        public int SessionId { get; set; }
        public DateTime CompletedAt { get; set; }
        public string? Notes { get; set; }
    }

    public class TodayStatsDto
    {
        public int CompletedSessions { get; set; }
        public int TotalWorkTime { get; set; } // in minutes
        public int CurrentStreak { get; set; }
        public int BestStreak { get; set; }
    }

    public class WeeklyGoalDto
    {
        public int Target { get; set; }
        public int Completed { get; set; }
        public double ProgressPercentage => Target > 0 ? Math.Min((double)Completed / Target * 100, 100) : 0;
    }

    public class DashboardDto
    {
        public TodayStatsDto TodayStats { get; set; } = new();
        public WeeklyGoalDto WeeklyGoal { get; set; } = new();
        public List<SessionDto> RecentSessions { get; set; } = new();
    }

    public class ActiveSessionDto
    {
        public int Id { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int DurationMinutes { get; set; }
        public int RemainingSeconds { get; set; }
        public int ElapsedSeconds { get; set; }
        public DateTime? EstimatedEndTime { get; set; }
        public double ProgressPercentage { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? LastUpdated { get; set; }
        public string? Notes { get; set; }
    }

    public class UpdateTimerDto
    {
        public int SessionId { get; set; }
        public string Action { get; set; } = string.Empty; // "start", "pause", "resume"
    }

    public class TimerStateDto
    {
        public bool HasActiveSession { get; set; }
        public ActiveSessionDto? ActiveSession { get; set; }
        public string? Message { get; set; }
    }
} 