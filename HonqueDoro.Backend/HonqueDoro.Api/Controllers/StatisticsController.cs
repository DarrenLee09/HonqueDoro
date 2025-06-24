using HonqueDoro.Api.Data;
using HonqueDoro.Api.DTOs;
using HonqueDoro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatisticsController : ControllerBase
    {
        private readonly HonqueDoroContext _context;
        private readonly ILogger<StatisticsController> _logger;

        public StatisticsController(HonqueDoroContext context, ILogger<StatisticsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<StatisticsPageDto>> GetStatistics()
        {
            var overallStatsResult = await GetOverallStats();
            var weeklyDataResult = await GetWeeklyData();
            var achievementsResult = await GetAchievements();

            // Extract values from ActionResult
            var overallStats = overallStatsResult.Value!;
            var weeklyData = weeklyDataResult.Value!;
            var achievements = achievementsResult.Value!;

            return new StatisticsPageDto
            {
                OverallStats = overallStats,
                WeeklyData = weeklyData,
                Achievements = achievements
            };
        }

        [HttpGet("overall")]
        public async Task<ActionResult<OverallStatsDto>> GetOverallStats()
        {
            var totalSessions = await _context.PomodoroSessions
                .CountAsync(s => s.IsCompleted && s.Type == SessionType.Work);

            var totalFocusTime = await _context.PomodoroSessions
                .Where(s => s.IsCompleted && s.Type == SessionType.Work)
                .SumAsync(s => s.DurationMinutes);

            var currentStreak = await CalculateCurrentStreak();
            var longestStreak = await GetLongestStreak();
            var averageSessionsPerDay = await CalculateAverageSessionsPerDay();

            return new OverallStatsDto
            {
                TotalSessions = totalSessions,
                TotalFocusTime = totalFocusTime,
                AverageSessionsPerDay = averageSessionsPerDay,
                CurrentStreak = currentStreak,
                LongestStreak = longestStreak
            };
        }

        [HttpGet("weekly")]
        public async Task<ActionResult<List<WeeklyDataDto>>> GetWeeklyData()
        {
            var today = DateTime.UtcNow.Date;
            var startOfWeek = today.AddDays(-(int)today.DayOfWeek);

            var weeklyData = new List<WeeklyDataDto>();
            var dayNames = new[] { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };

            for (int i = 0; i < 7; i++)
            {
                var date = startOfWeek.AddDays(i);
                var nextDate = date.AddDays(1);

                var sessions = await _context.PomodoroSessions
                    .Where(s => s.IsCompleted && 
                               s.Type == SessionType.Work && 
                               s.EndTime >= date && 
                               s.EndTime < nextDate)
                    .ToListAsync();

                weeklyData.Add(new WeeklyDataDto
                {
                    Day = dayNames[i],
                    Sessions = sessions.Count,
                    FocusTime = sessions.Sum(s => s.DurationMinutes)
                });
            }

            return weeklyData;
        }

        [HttpGet("achievements")]
        public async Task<ActionResult<List<AchievementDto>>> GetAchievements()
        {
            var achievements = await _context.Achievements
                .OrderBy(a => a.Id)
                .Select(a => new AchievementDto
                {
                    Id = a.Id,
                    Title = a.Title,
                    Description = a.Description,
                    Icon = a.Icon,
                    Earned = a.IsEarned,
                    EarnedDate = a.EarnedDate
                })
                .ToListAsync();

            return achievements;
        }

        [HttpGet("monthly/{year}/{month}")]
        public async Task<ActionResult<List<WeeklyDataDto>>> GetMonthlyData(int year, int month)
        {
            var startOfMonth = new DateTime(year, month, 1);
            var endOfMonth = startOfMonth.AddMonths(1);

            var sessions = await _context.PomodoroSessions
                .Where(s => s.IsCompleted && 
                           s.Type == SessionType.Work && 
                           s.EndTime >= startOfMonth && 
                           s.EndTime < endOfMonth)
                .GroupBy(s => s.EndTime!.Value.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Sessions = g.Count(),
                    FocusTime = g.Sum(s => s.DurationMinutes)
                })
                .ToListAsync();

            var monthlyData = new List<WeeklyDataDto>();
            for (var date = startOfMonth; date < endOfMonth; date = date.AddDays(1))
            {
                var dayData = sessions.FirstOrDefault(s => s.Date == date);
                monthlyData.Add(new WeeklyDataDto
                {
                    Day = date.ToString("dd"),
                    Sessions = dayData?.Sessions ?? 0,
                    FocusTime = dayData?.FocusTime ?? 0
                });
            }

            return monthlyData;
        }

        private async Task<int> CalculateCurrentStreak()
        {
            var today = DateTime.UtcNow.Date;
            var streak = 0;
            var checkDate = today;

            while (true)
            {
                var hasSession = await _context.PomodoroSessions
                    .AnyAsync(s => s.IsCompleted && 
                                   s.Type == SessionType.Work && 
                                   s.EndTime!.Value.Date == checkDate);

                if (hasSession)
                {
                    streak++;
                    checkDate = checkDate.AddDays(-1);
                }
                else
                {
                    break;
                }
            }

            return streak;
        }

        private async Task<int> GetLongestStreak()
        {
            var stats = await _context.UserStatistics
                .OrderByDescending(s => s.BestStreak)
                .FirstOrDefaultAsync();

            return stats?.BestStreak ?? 0;
        }

        private async Task<double> CalculateAverageSessionsPerDay()
        {
            var firstSessionDate = await _context.PomodoroSessions
                .Where(s => s.IsCompleted && s.Type == SessionType.Work)
                .OrderBy(s => s.EndTime)
                .Select(s => s.EndTime!.Value.Date)
                .FirstOrDefaultAsync();

            if (firstSessionDate == default)
                return 0;

            var totalDays = (DateTime.UtcNow.Date - firstSessionDate).Days + 1;
            var totalSessions = await _context.PomodoroSessions
                .CountAsync(s => s.IsCompleted && s.Type == SessionType.Work);

            return totalDays > 0 ? Math.Round((double)totalSessions / totalDays, 1) : 0;
        }
    }
} 