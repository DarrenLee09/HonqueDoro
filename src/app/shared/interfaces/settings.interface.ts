export interface AppSettings {
  // Timer Durations
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  
  // Automation
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  
  // Notifications
  soundEnabled: boolean;
  desktopNotifications: boolean;
  
  // Appearance
  darkMode: boolean;
  
  // Goals
  dailyGoal: number;
}