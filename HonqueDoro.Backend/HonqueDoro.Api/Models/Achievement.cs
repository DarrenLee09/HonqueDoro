using System.ComponentModel.DataAnnotations;

namespace HonqueDoro.Api.Models
{
    public class Achievement
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(10)]
        public string Icon { get; set; } = string.Empty;
        
        public bool IsEarned { get; set; }
        
        public DateTime? EarnedDate { get; set; }
        
        public int RequiredCount { get; set; } // For achievements that require X sessions/days
        
        public AchievementType Type { get; set; }
        
        // Navigation properties for user management (if needed later)
        public string? UserId { get; set; }
    }

    public enum AchievementType
    {
        FirstSession = 1,
        Consistency = 2,
        TotalSessions = 3,
        Streak = 4
    }
} 