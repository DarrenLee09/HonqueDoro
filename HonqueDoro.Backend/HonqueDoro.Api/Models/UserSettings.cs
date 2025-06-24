using System.ComponentModel.DataAnnotations;

namespace HonqueDoro.Api.Models
{
    public class UserSettings
    {
        public int Id { get; set; }
        
        [Range(1, 60, ErrorMessage = "Work duration must be between 1 and 60 minutes")]
        public int WorkDurationMinutes { get; set; } = 25;
        
        [Range(1, 30, ErrorMessage = "Short break duration must be between 1 and 30 minutes")]
        public int ShortBreakDurationMinutes { get; set; } = 5;
        
        [Range(1, 60, ErrorMessage = "Long break duration must be between 1 and 60 minutes")]
        public int LongBreakDurationMinutes { get; set; } = 15;
        
        [Range(2, 10, ErrorMessage = "Sessions until long break must be between 2 and 10")]
        public int SessionsUntilLongBreak { get; set; } = 4;
        
        public bool AutoStartBreaks { get; set; } = false;
        
        public bool AutoStartWork { get; set; } = false;
        
        public bool PlayNotificationSounds { get; set; } = true;
        
        public bool ShowDesktopNotifications { get; set; } = true;
        
        [Range(1, 200, ErrorMessage = "Daily goal must be between 1 and 200 sessions")]
        public int DailyGoalSessions { get; set; } = 8;
        
        [Range(1, 100, ErrorMessage = "Weekly goal must be between 1 and 100 sessions")]
        public int WeeklyGoalSessions { get; set; } = 40;
        
        // Navigation properties for user management (if needed later)
        public string? UserId { get; set; }
    }
} 