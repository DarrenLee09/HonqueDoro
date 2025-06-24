namespace HonqueDoro.Api.DTOs
{
    public class OverallStatsDto
    {
        public int TotalSessions { get; set; }
        public int TotalFocusTime { get; set; } // in minutes
        public double AverageSessionsPerDay { get; set; }
        public int CurrentStreak { get; set; }
        public int LongestStreak { get; set; }
        public string TotalFocusTimeFormatted => FormatTime(TotalFocusTime);

        private static string FormatTime(int minutes)
        {
            var hours = minutes / 60;
            var mins = minutes % 60;
            return $"{hours}h {mins}m";
        }
    }

    public class WeeklyDataDto
    {
        public string Day { get; set; } = string.Empty;
        public int Sessions { get; set; }
        public int FocusTime { get; set; }
    }

    public class AchievementDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public bool Earned { get; set; }
        public DateTime? EarnedDate { get; set; }
    }

    public class StatisticsPageDto
    {
        public OverallStatsDto OverallStats { get; set; } = new();
        public List<WeeklyDataDto> WeeklyData { get; set; } = new();
        public List<AchievementDto> Achievements { get; set; } = new();
        public int MaxSessions => WeeklyData.Any() ? WeeklyData.Max(d => d.Sessions) : 1;
        public int EarnedAchievements => Achievements.Count(a => a.Earned);
    }
} 