using HonqueDoro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Data
{
    public static class SampleDataService
    {
        public static async Task SeedSampleDataAsync(HonqueDoroContext context)
        {
            // Check if we already have data
            if (await context.PomodoroSessions.AnyAsync())
            {
                return; // Database already seeded
            }

            // Create sample sessions for the past week
            var today = DateTime.UtcNow.Date;
            var sessions = new List<PomodoroSession>();

            // Add sessions for the past 7 days
            for (int day = -6; day <= 0; day++)
            {
                var sessionDate = today.AddDays(day);
                var random = new Random(day + 100); // Consistent randomization
                
                var sessionsForDay = random.Next(2, 9); // 2-8 sessions per day
                
                for (int session = 0; session < sessionsForDay; session++)
                {
                    var startTime = sessionDate.AddHours(9 + session).AddMinutes(random.Next(0, 30));
                    var endTime = startTime.AddMinutes(25);
                    
                    sessions.Add(new PomodoroSession
                    {
                        Type = SessionType.Work,
                        DurationMinutes = 25,
                        StartTime = startTime,
                        EndTime = endTime,
                        IsCompleted = true,
                        Notes = session % 3 == 0 ? $"Productive session #{session + 1}" : null
                    });

                    // Add some break sessions
                    if (session % 4 == 3) // Long break every 4th session
                    {
                        sessions.Add(new PomodoroSession
                        {
                            Type = SessionType.LongBreak,
                            DurationMinutes = 15,
                            StartTime = endTime,
                            EndTime = endTime.AddMinutes(15),
                            IsCompleted = true
                        });
                    }
                    else if (session < sessionsForDay - 1) // Short break between sessions
                    {
                        sessions.Add(new PomodoroSession
                        {
                            Type = SessionType.ShortBreak,
                            DurationMinutes = 5,
                            StartTime = endTime,
                            EndTime = endTime.AddMinutes(5),
                            IsCompleted = true
                        });
                    }
                }
            }

            context.PomodoroSessions.AddRange(sessions);

            // Add sample user statistics
            var stats = new List<UserStatistics>();
            for (int day = -6; day <= 0; day++)
            {
                var date = today.AddDays(day);
                var sessionsForDay = sessions.Count(s => s.StartTime.Date == date && s.Type == SessionType.Work);
                var workTimeForDay = sessionsForDay * 25;

                stats.Add(new UserStatistics
                {
                    Date = date,
                    CompletedSessions = sessionsForDay,
                    TotalWorkTimeMinutes = workTimeForDay,
                    CurrentStreak = Math.Abs(day) + 1, // Simple streak calculation
                    BestStreak = 12, // Sample best streak
                    WeeklyTarget = 40,
                    WeeklyCompleted = sessions.Count(s => s.Type == SessionType.Work && s.IsCompleted)
                });
            }

            context.UserStatistics.AddRange(stats);

            // Add default user settings
            var defaultSettings = new UserSettings
            {
                WorkDurationMinutes = 25,
                ShortBreakDurationMinutes = 5,
                LongBreakDurationMinutes = 15,
                SessionsUntilLongBreak = 4,
                AutoStartBreaks = false,
                AutoStartWork = false,
                PlayNotificationSounds = true,
                ShowDesktopNotifications = true,
                DailyGoalSessions = 8,
                WeeklyGoalSessions = 40
            };

            context.UserSettings.Add(defaultSettings);

            // Mark some achievements as earned based on sample data
            var achievements = await context.Achievements.ToListAsync();
            if (achievements.Any())
            {
                // Mark first session achievement as earned
                var firstSessionAchievement = achievements.FirstOrDefault(a => a.Type == AchievementType.FirstSession);
                if (firstSessionAchievement != null)
                {
                    firstSessionAchievement.IsEarned = true;
                    firstSessionAchievement.EarnedDate = sessions.OrderBy(s => s.StartTime).First().StartTime;
                }

                // Mark 50 sessions achievement if we have enough
                var totalWorkSessions = sessions.Count(s => s.Type == SessionType.Work);
                var focusChampionAchievement = achievements.FirstOrDefault(a => a.Type == AchievementType.TotalSessions && a.RequiredCount == 50);
                if (focusChampionAchievement != null && totalWorkSessions >= 50)
                {
                    focusChampionAchievement.IsEarned = true;
                    focusChampionAchievement.EarnedDate = today.AddDays(-2);
                }

                // Mark 7-day streak achievement
                var consistencyAchievement = achievements.FirstOrDefault(a => a.Type == AchievementType.Streak && a.RequiredCount == 7);
                if (consistencyAchievement != null)
                {
                    consistencyAchievement.IsEarned = true;
                    consistencyAchievement.EarnedDate = today.AddDays(-1);
                }
            }

            await context.SaveChangesAsync();
        }
    }
} 