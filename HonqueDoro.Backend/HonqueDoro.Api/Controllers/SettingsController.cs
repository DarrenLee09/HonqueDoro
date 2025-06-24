using HonqueDoro.Api.Data;
using HonqueDoro.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HonqueDoro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private readonly HonqueDoroContext _context;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(HonqueDoroContext context, ILogger<SettingsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<UserSettings>> GetSettings([FromQuery] string? userId = null)
        {
            var settings = await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (settings == null)
            {
                // Return default settings if none exist
                settings = new UserSettings
                {
                    UserId = userId
                };
            }

            return settings;
        }

        [HttpPost]
        public async Task<ActionResult<UserSettings>> CreateOrUpdateSettings([FromBody] UserSettings userSettings)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var existingSettings = await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userSettings.UserId);

            if (existingSettings == null)
            {
                _context.UserSettings.Add(userSettings);
                _logger.LogInformation($"Creating new settings for user {userSettings.UserId}");
            }
            else
            {
                // Update existing settings
                existingSettings.WorkDurationMinutes = userSettings.WorkDurationMinutes;
                existingSettings.ShortBreakDurationMinutes = userSettings.ShortBreakDurationMinutes;
                existingSettings.LongBreakDurationMinutes = userSettings.LongBreakDurationMinutes;
                existingSettings.SessionsUntilLongBreak = userSettings.SessionsUntilLongBreak;
                existingSettings.AutoStartBreaks = userSettings.AutoStartBreaks;
                existingSettings.AutoStartWork = userSettings.AutoStartWork;
                existingSettings.PlayNotificationSounds = userSettings.PlayNotificationSounds;
                existingSettings.ShowDesktopNotifications = userSettings.ShowDesktopNotifications;
                existingSettings.DailyGoalSessions = userSettings.DailyGoalSessions;
                existingSettings.WeeklyGoalSessions = userSettings.WeeklyGoalSessions;

                userSettings = existingSettings;
                _logger.LogInformation($"Updating settings for user {userSettings.UserId}");
            }

            await _context.SaveChangesAsync();

            return Ok(userSettings);
        }

        [HttpPut]
        public async Task<ActionResult<UserSettings>> UpdateSettings([FromBody] UserSettings userSettings)
        {
            return await CreateOrUpdateSettings(userSettings);
        }

        [HttpPost("reset")]
        public async Task<ActionResult<UserSettings>> ResetToDefaults([FromQuery] string? userId = null)
        {
            var defaultSettings = new UserSettings
            {
                UserId = userId,
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

            var existingSettings = await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (existingSettings != null)
            {
                _context.UserSettings.Remove(existingSettings);
            }

            _context.UserSettings.Add(defaultSettings);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Reset settings to defaults for user {userId}");

            return Ok(defaultSettings);
        }

        [HttpGet("timer-config")]
        public async Task<ActionResult<object>> GetTimerConfiguration([FromQuery] string? userId = null)
        {
            var settings = await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (settings == null)
            {
                settings = new UserSettings { UserId = userId };
            }

            return new
            {
                workDuration = settings.WorkDurationMinutes,
                shortBreakDuration = settings.ShortBreakDurationMinutes,
                longBreakDuration = settings.LongBreakDurationMinutes,
                sessionsUntilLongBreak = settings.SessionsUntilLongBreak,
                autoStartBreaks = settings.AutoStartBreaks,
                autoStartWork = settings.AutoStartWork,
                playNotificationSounds = settings.PlayNotificationSounds,
                showDesktopNotifications = settings.ShowDesktopNotifications
            };
        }

        [HttpPost("timer-config")]
        public async Task<ActionResult> UpdateTimerConfiguration([FromBody] object timerConfig, [FromQuery] string? userId = null)
        {
            var settings = await _context.UserSettings
                .FirstOrDefaultAsync(s => s.UserId == userId);

            if (settings == null)
            {
                settings = new UserSettings { UserId = userId };
                _context.UserSettings.Add(settings);
            }

            // Parse the timer config object (you might want to create a specific DTO for this)
            // For now, we'll handle it as a dynamic object
            try
            {
                var configJson = System.Text.Json.JsonSerializer.Serialize(timerConfig);
                var configDict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(configJson);

                if (configDict != null)
                {
                    if (configDict.TryGetValue("workDuration", out var workDuration))
                        settings.WorkDurationMinutes = Convert.ToInt32(workDuration);
                    
                    if (configDict.TryGetValue("shortBreakDuration", out var shortBreakDuration))
                        settings.ShortBreakDurationMinutes = Convert.ToInt32(shortBreakDuration);
                    
                    if (configDict.TryGetValue("longBreakDuration", out var longBreakDuration))
                        settings.LongBreakDurationMinutes = Convert.ToInt32(longBreakDuration);
                    
                    if (configDict.TryGetValue("sessionsUntilLongBreak", out var sessionsUntilLongBreak))
                        settings.SessionsUntilLongBreak = Convert.ToInt32(sessionsUntilLongBreak);
                    
                    if (configDict.TryGetValue("autoStartBreaks", out var autoStartBreaks))
                        settings.AutoStartBreaks = Convert.ToBoolean(autoStartBreaks);
                    
                    if (configDict.TryGetValue("autoStartWork", out var autoStartWork))
                        settings.AutoStartWork = Convert.ToBoolean(autoStartWork);
                    
                    if (configDict.TryGetValue("playNotificationSounds", out var playNotificationSounds))
                        settings.PlayNotificationSounds = Convert.ToBoolean(playNotificationSounds);
                    
                    if (configDict.TryGetValue("showDesktopNotifications", out var showDesktopNotifications))
                        settings.ShowDesktopNotifications = Convert.ToBoolean(showDesktopNotifications);
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation($"Updated timer configuration for user {userId}");

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating timer configuration");
                return BadRequest("Invalid configuration data");
            }
        }
    }
} 