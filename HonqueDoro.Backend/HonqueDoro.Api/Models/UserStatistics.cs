using System.ComponentModel.DataAnnotations;

namespace HonqueDoro.Api.Models
{
    public class UserStatistics
    {
        public int Id { get; set; }
        
        public DateTime Date { get; set; }
        
        public int CompletedSessions { get; set; }
        
        public int TotalWorkTimeMinutes { get; set; }
        
        public int CurrentStreak { get; set; }
        
        public int BestStreak { get; set; }
        
        public int WeeklyTarget { get; set; } = 40; // Default weekly target sessions
        
        public int WeeklyCompleted { get; set; }
        
        // Navigation properties for user management (if needed later)
        public string? UserId { get; set; }
    }
} 