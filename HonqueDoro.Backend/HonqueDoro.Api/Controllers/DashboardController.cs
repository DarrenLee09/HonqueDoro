using HonqueDoro.Api.Data;
using HonqueDoro.Api.DTOs;
using HonqueDoro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly HonqueDoroContext _context;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(HonqueDoroContext context, ILogger<DashboardController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<DashboardDto>> GetDashboardData()
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            // Get today's stats
            var todayStatsResult = await GetTodayStats();
            
            // Get weekly goal
            var weeklyGoalResult = await GetWeeklyGoal();
            
            // Extract values from ActionResult
            var todayStats = todayStatsResult.Value!;
            var weeklyGoal = weeklyGoalResult.Value!;
            
            // Get recent sessions
            var recentSessions = await _context.PomodoroSessions
                .Where(s => s.IsCompleted)
                .OrderByDescending(s => s.EndTime)
                .Take(4)
                .Select(s => new SessionDto
                {
                    Id = s.Id,
                    Type = s.Type.ToString(),
                    Duration = s.DurationMinutes,
                    CompletedAt = s.EndTime ?? s.StartTime,
                    IsCompleted = s.IsCompleted,
                    Notes = s.Notes
                })
                .ToListAsync();

            var dashboard = new DashboardDto
            {
                TodayStats = todayStats,
                WeeklyGoal = weeklyGoal,
                RecentSessions = recentSessions
            };

            return dashboard;
        }

        [HttpGet("today-stats")]
        public async Task<ActionResult<TodayStatsDto>> GetTodayStats()
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            var todaySessions = await _context.PomodoroSessions
                .Where(s => s.IsCompleted && 
                           s.Type == SessionType.Work && 
                           s.EndTime >= today && 
                           s.EndTime < tomorrow)
                .ToListAsync();

            var completedSessions = todaySessions.Count;
            var totalWorkTime = todaySessions.Sum(s => s.DurationMinutes);
            var currentStreak = await CalculateCurrentStreak();
            var bestStreak = await GetBestStreak();

            return new TodayStatsDto
            {
                CompletedSessions = completedSessions,
                TotalWorkTime = totalWorkTime,
                CurrentStreak = currentStreak,
                BestStreak = bestStreak
            };
        }

        [HttpGet("weekly-goal")]
        public async Task<ActionResult<WeeklyGoalDto>> GetWeeklyGoal()
        {
            var today = DateTime.UtcNow.Date;
            var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
            var endOfWeek = startOfWeek.AddDays(7);

            var weeklyCompleted = await _context.PomodoroSessions
                .CountAsync(s => s.IsCompleted && 
                                s.Type == SessionType.Work && 
                                s.EndTime >= startOfWeek && 
                                s.EndTime < endOfWeek);

            // Get target from user settings or use default
            var settings = await _context.UserSettings.FirstOrDefaultAsync();
            var target = settings?.WeeklyGoalSessions ?? 40;

            return new WeeklyGoalDto
            {
                Target = target,
                Completed = weeklyCompleted
            };
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

        private async Task<int> GetBestStreak()
        {
            var stats = await _context.UserStatistics
                .OrderByDescending(s => s.BestStreak)
                .FirstOrDefaultAsync();

            return stats?.BestStreak ?? 0;
        }
    }
} 