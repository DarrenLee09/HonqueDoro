using System.ComponentModel.DataAnnotations;

namespace HonqueDoro.Api.Models
{
    public enum SessionType
    {
        Work,
        ShortBreak,
        LongBreak
    }

    public enum SessionStatus
    {
        NotStarted,
        Active,
        Paused,
        Completed,
        Cancelled
    }

    public class PomodoroSession
    {
        public int Id { get; set; }
        
        [Required]
        public SessionType Type { get; set; }
        
        [Required]
        [Range(1, 60)]
        public int DurationMinutes { get; set; }
        
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public DateTime? PausedAt { get; set; }
        public int PausedDurationSeconds { get; set; } = 0;
        
        public bool IsCompleted { get; set; }
        public SessionStatus Status { get; set; } = SessionStatus.NotStarted;
        
        public string? Notes { get; set; }
        public string? UserId { get; set; } = "default-user";

        // Timer-specific properties
        public DateTime? LastUpdated { get; set; }
        public int ElapsedSeconds { get; set; } = 0;
        
        // Calculated properties
        public int TotalDurationSeconds => DurationMinutes * 60;
        
        public int RemainingSeconds 
        { 
            get 
            {
                if (Status == SessionStatus.Active && LastUpdated.HasValue)
                {
                    var actualElapsed = ElapsedSeconds + (int)(DateTime.UtcNow - LastUpdated.Value).TotalSeconds;
                    return Math.Max(0, TotalDurationSeconds - actualElapsed);
                }
                else if (Status == SessionStatus.Paused)
                {
                    return Math.Max(0, TotalDurationSeconds - ElapsedSeconds);
                }
                else if (Status == SessionStatus.NotStarted)
                {
                    return TotalDurationSeconds;
                }
                return 0;
            }
        }

        public DateTime? EstimatedEndTime
        {
            get
            {
                if (Status == SessionStatus.Active && RemainingSeconds > 0)
                {
                    return DateTime.UtcNow.AddSeconds(RemainingSeconds);
                }
                return null;
            }
        }

        public double ProgressPercentage
        {
            get
            {
                if (TotalDurationSeconds == 0) return 0;
                var elapsed = TotalDurationSeconds - RemainingSeconds;
                return Math.Min(100, (double)elapsed / TotalDurationSeconds * 100);
            }
        }
    }
} 