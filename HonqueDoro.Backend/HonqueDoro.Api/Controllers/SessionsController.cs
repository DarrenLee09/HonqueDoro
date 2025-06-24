using HonqueDoro.Api.Data;
using HonqueDoro.Api.DTOs;
using HonqueDoro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SessionsController : ControllerBase
    {
        private readonly HonqueDoroContext _context;
        private readonly ILogger<SessionsController> _logger;

        public SessionsController(HonqueDoroContext context, ILogger<SessionsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpPost("start")]
        public async Task<ActionResult<ActiveSessionDto>> StartSession([FromBody] CreateSessionDto createSessionDto)
        {
            // Check if there's already an active session
            var activeSession = await _context.PomodoroSessions
                .FirstOrDefaultAsync(s => s.Status == SessionStatus.Active || s.Status == SessionStatus.Paused);

            if (activeSession != null)
            {
                return BadRequest("There is already an active session. Please complete or cancel it first.");
            }

            var session = new PomodoroSession
            {
                Type = createSessionDto.Type,
                DurationMinutes = createSessionDto.DurationMinutes,
                StartTime = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow,
                Status = SessionStatus.Active,
                IsCompleted = false,
                Notes = createSessionDto.Notes,
                ElapsedSeconds = 0
            };

            _context.PomodoroSessions.Add(session);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Started {session.Type} session with duration {session.DurationMinutes} minutes");

            return Ok(MapToActiveSessionDto(session));
        }

        [HttpPost("pause/{sessionId}")]
        public async Task<ActionResult<ActiveSessionDto>> PauseSession(int sessionId)
        {
            var session = await _context.PomodoroSessions.FindAsync(sessionId);
            
            if (session == null)
            {
                return NotFound($"Session with ID {sessionId} not found");
            }

            if (session.Status != SessionStatus.Active)
            {
                return BadRequest("Session is not currently active");
            }

            // Calculate elapsed time and update session
            if (session.LastUpdated.HasValue)
            {
                session.ElapsedSeconds += (int)(DateTime.UtcNow - session.LastUpdated.Value).TotalSeconds;
            }

            session.Status = SessionStatus.Paused;
            session.PausedAt = DateTime.UtcNow;
            session.LastUpdated = null;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Paused session {sessionId}");

            return Ok(MapToActiveSessionDto(session));
        }

        [HttpPost("resume/{sessionId}")]
        public async Task<ActionResult<ActiveSessionDto>> ResumeSession(int sessionId)
        {
            var session = await _context.PomodoroSessions.FindAsync(sessionId);
            
            if (session == null)
            {
                return NotFound($"Session with ID {sessionId} not found");
            }

            if (session.Status != SessionStatus.Paused)
            {
                return BadRequest("Session is not currently paused");
            }

            session.Status = SessionStatus.Active;
            session.LastUpdated = DateTime.UtcNow;
            session.PausedAt = null;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Resumed session {sessionId}");

            return Ok(MapToActiveSessionDto(session));
        }

        [HttpPost("complete/{sessionId}")]
        public async Task<ActionResult> CompleteSession(int sessionId, [FromBody] CompleteSessionDto? completeDto = null)
        {
            var session = await _context.PomodoroSessions.FindAsync(sessionId);
            
            if (session == null)
            {
                return NotFound($"Session with ID {sessionId} not found");
            }

            if (session.IsCompleted)
            {
                return BadRequest("Session is already completed");
            }

            // Calculate final elapsed time if session was active
            if (session.Status == SessionStatus.Active && session.LastUpdated.HasValue)
            {
                session.ElapsedSeconds += (int)(DateTime.UtcNow - session.LastUpdated.Value).TotalSeconds;
            }

            session.IsCompleted = true;
            session.Status = SessionStatus.Completed;
            session.EndTime = completeDto?.CompletedAt ?? DateTime.UtcNow;
            session.LastUpdated = null;
            
            if (!string.IsNullOrEmpty(completeDto?.Notes))
            {
                session.Notes = completeDto.Notes;
            }

            // Update statistics if it's a work session
            if (session.Type == SessionType.Work)
            {
                await UpdateUserStatistics(session);
                await CheckAndUpdateAchievements();
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Completed {session.Type} session {session.Id}");

            return Ok();
        }

        [HttpDelete("cancel/{sessionId}")]
        public async Task<ActionResult> CancelSession(int sessionId)
        {
            var session = await _context.PomodoroSessions.FindAsync(sessionId);
            
            if (session == null)
            {
                return NotFound($"Session with ID {sessionId} not found");
            }

            if (session.IsCompleted)
            {
                return BadRequest("Cannot cancel a completed session");
            }

            session.Status = SessionStatus.Cancelled;
            session.LastUpdated = null;
            session.EndTime = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation($"Cancelled session {sessionId}");

            return Ok();
        }

        [HttpGet("active")]
        public async Task<ActionResult<TimerStateDto>> GetActiveSession()
        {
            var activeSession = await _context.PomodoroSessions
                .FirstOrDefaultAsync(s => s.Status == SessionStatus.Active || s.Status == SessionStatus.Paused);

            if (activeSession == null)
            {
                return Ok(new TimerStateDto 
                { 
                    HasActiveSession = false,
                    Message = "No active session"
                });
            }

            // Auto-complete if time is up
            if (activeSession.RemainingSeconds <= 0 && activeSession.Status == SessionStatus.Active)
            {
                await CompleteSession(activeSession.Id);
                return Ok(new TimerStateDto 
                { 
                    HasActiveSession = false,
                    Message = "Session automatically completed"
                });
            }

            return Ok(new TimerStateDto
            {
                HasActiveSession = true,
                ActiveSession = MapToActiveSessionDto(activeSession)
            });
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<SessionDto>> GetSession(int id)
        {
            var session = await _context.PomodoroSessions.FindAsync(id);

            if (session == null)
            {
                return NotFound();
            }

            return MapToSessionDto(session);
        }

        [HttpGet("recent")]
        public async Task<ActionResult<List<SessionDto>>> GetRecentSessions([FromQuery] int count = 10)
        {
            var sessions = await _context.PomodoroSessions
                .Where(s => s.IsCompleted)
                .OrderByDescending(s => s.EndTime)
                .Take(count)
                .ToListAsync();

            return sessions.Select(MapToSessionDto).ToList();
        }

        [HttpGet("today")]
        public async Task<ActionResult<List<SessionDto>>> GetTodaySessions()
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            var sessions = await _context.PomodoroSessions
                .Where(s => s.IsCompleted && s.EndTime >= today && s.EndTime < tomorrow)
                .OrderBy(s => s.EndTime)
                .ToListAsync();

            return sessions.Select(MapToSessionDto).ToList();
        }

        private ActiveSessionDto MapToActiveSessionDto(PomodoroSession session)
        {
            return new ActiveSessionDto
            {
                Id = session.Id,
                Type = session.Type.ToString(),
                Status = session.Status.ToString(),
                DurationMinutes = session.DurationMinutes,
                RemainingSeconds = session.RemainingSeconds,
                ElapsedSeconds = session.ElapsedSeconds,
                EstimatedEndTime = session.EstimatedEndTime,
                ProgressPercentage = session.ProgressPercentage,
                StartTime = session.StartTime,
                LastUpdated = session.LastUpdated,
                Notes = session.Notes
            };
        }

        private SessionDto MapToSessionDto(PomodoroSession session)
        {
            return new SessionDto
            {
                Id = session.Id,
                Type = session.Type.ToString(),
                Duration = session.DurationMinutes,
                CompletedAt = session.EndTime ?? session.StartTime,
                IsCompleted = session.IsCompleted,
                Notes = session.Notes,
                Status = session.Status.ToString(),
                RemainingSeconds = session.RemainingSeconds,
                ElapsedSeconds = session.ElapsedSeconds,
                EstimatedEndTime = session.EstimatedEndTime,
                ProgressPercentage = session.ProgressPercentage,
                LastUpdated = session.LastUpdated
            };
        }

        private async Task UpdateUserStatistics(PomodoroSession session)
        {
            var today = DateTime.UtcNow.Date;
            
            var stats = await _context.UserStatistics
                .FirstOrDefaultAsync(s => s.Date == today && s.UserId == session.UserId);

            if (stats == null)
            {
                stats = new UserStatistics
                {
                    Date = today,
                    UserId = session.UserId,
                    CompletedSessions = 1,
                    TotalWorkTimeMinutes = session.DurationMinutes,
                    CurrentStreak = await CalculateCurrentStreak(),
                    BestStreak = 1,
                    WeeklyCompleted = await CalculateWeeklyCompleted()
                };
                _context.UserStatistics.Add(stats);
            }
            else
            {
                stats.CompletedSessions++;
                stats.TotalWorkTimeMinutes += session.DurationMinutes;
                stats.CurrentStreak = await CalculateCurrentStreak();
                stats.BestStreak = Math.Max(stats.BestStreak, stats.CurrentStreak);
                stats.WeeklyCompleted = await CalculateWeeklyCompleted();
            }
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

        private async Task<int> CalculateWeeklyCompleted()
        {
            var today = DateTime.UtcNow.Date;
            var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
            var endOfWeek = startOfWeek.AddDays(7);

            return await _context.PomodoroSessions
                .CountAsync(s => s.IsCompleted && 
                                 s.Type == SessionType.Work && 
                                 s.EndTime >= startOfWeek && 
                                 s.EndTime < endOfWeek);
        }

        private async Task CheckAndUpdateAchievements()
        {
            var totalSessions = await _context.PomodoroSessions
                .CountAsync(s => s.IsCompleted && s.Type == SessionType.Work);

            var currentStreak = await CalculateCurrentStreak();

            var achievements = await _context.Achievements.ToListAsync();

            foreach (var achievement in achievements.Where(a => !a.IsEarned))
            {
                bool shouldEarn = achievement.Type switch
                {
                    AchievementType.FirstSession => totalSessions >= 1,
                    AchievementType.TotalSessions => totalSessions >= achievement.RequiredCount,
                    AchievementType.Streak => currentStreak >= achievement.RequiredCount,
                    _ => false
                };

                if (shouldEarn)
                {
                    achievement.IsEarned = true;
                    achievement.EarnedDate = DateTime.UtcNow;
                    _logger.LogInformation($"Achievement earned: {achievement.Title}");
                }
            }
        }
    }
} 