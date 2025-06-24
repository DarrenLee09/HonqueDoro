using HonqueDoro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Data
{
    public class HonqueDoroContext : DbContext
    {
        public HonqueDoroContext(DbContextOptions<HonqueDoroContext> options) : base(options)
        {
        }

        public DbSet<PomodoroSession> PomodoroSessions { get; set; }
        public DbSet<UserStatistics> UserStatistics { get; set; }
        public DbSet<Achievement> Achievements { get; set; }
        public DbSet<UserSettings> UserSettings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure PomodoroSession
            modelBuilder.Entity<PomodoroSession>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Type).HasConversion<int>();
                entity.Property(e => e.DurationMinutes).IsRequired();
                entity.Property(e => e.StartTime).IsRequired();
                entity.Property(e => e.Notes).HasMaxLength(1000);
            });

            // Configure UserStatistics
            modelBuilder.Entity<UserStatistics>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Date).IsRequired();
                entity.HasIndex(e => new { e.Date, e.UserId }).IsUnique();
            });

            // Configure Achievement
            modelBuilder.Entity<Achievement>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Description).IsRequired().HasMaxLength(500);
                entity.Property(e => e.Icon).IsRequired().HasMaxLength(10);
                entity.Property(e => e.Type).HasConversion<int>();
            });

            // Configure UserSettings
            modelBuilder.Entity<UserSettings>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.UserId).IsUnique();
            });

            // Seed initial achievements
            SeedAchievements(modelBuilder);
        }

        private static void SeedAchievements(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Achievement>().HasData(
                new Achievement
                {
                    Id = 1,
                    Title = "First Session",
                    Description = "Complete your first Pomodoro session",
                    Icon = "🍅",
                    Type = AchievementType.FirstSession,
                    RequiredCount = 1,
                    IsEarned = false
                },
                new Achievement
                {
                    Id = 2,
                    Title = "Consistency Master",
                    Description = "Complete sessions for 7 days in a row",
                    Icon = "🔥",
                    Type = AchievementType.Streak,
                    RequiredCount = 7,
                    IsEarned = false
                },
                new Achievement
                {
                    Id = 3,
                    Title = "Focus Champion",
                    Description = "Complete 50 total sessions",
                    Icon = "🏆",
                    Type = AchievementType.TotalSessions,
                    RequiredCount = 50,
                    IsEarned = false
                },
                new Achievement
                {
                    Id = 4,
                    Title = "Marathon Runner",
                    Description = "Complete 100 total sessions",
                    Icon = "🏃",
                    Type = AchievementType.TotalSessions,
                    RequiredCount = 100,
                    IsEarned = false
                },
                new Achievement
                {
                    Id = 5,
                    Title = "Zen Master",
                    Description = "Complete 30 days streak",
                    Icon = "🧘",
                    Type = AchievementType.Streak,
                    RequiredCount = 30,
                    IsEarned = false
                },
                new Achievement
                {
                    Id = 6,
                    Title = "Productivity Guru",
                    Description = "Complete 500 total sessions",
                    Icon = "⭐",
                    Type = AchievementType.TotalSessions,
                    RequiredCount = 500,
                    IsEarned = false
                }
            );
        }
    }
} 