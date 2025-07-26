export const API_CONFIG = {
  BASE_URL: 'http://localhost:5116/api',
  ENDPOINTS: {
    SESSIONS: '/sessions',
    ACTIVE: '/sessions/active',
    RESUME: (id: number) => `/sessions/resume/${id}`,
    PAUSE: (id: number) => `/sessions/pause/${id}`,
    COMPLETE: (id: number) => `/sessions/complete/${id}`,
    DELETE: (id: number) => `/sessions/${id}`,
  }
} as const;

export const TIMER_DURATIONS = {
  WORK: 25 * 60, // 25 minutes in seconds
  SHORT_BREAK: 5 * 60, // 5 minutes in seconds
  LONG_BREAK: 15 * 60, // 15 minutes in seconds
  SESSIONS_UNTIL_LONG_BREAK: 4,
} as const;

export const TIMER_DEFAULTS = {
  WORK_DURATION_MINUTES: 25,
  SHORT_BREAK_DURATION_MINUTES: 5,
  LONG_BREAK_DURATION_MINUTES: 15,
  SESSIONS_UNTIL_LONG_BREAK: 4,
} as const;

export const STORAGE_KEYS = {
  TASKS: 'honquedoro-tasks',
  SETTINGS: 'honquedoro-settings',
} as const;

export const SESSION_TYPES = {
  WORK: 0,
  SHORT_BREAK: 1,
  LONG_BREAK: 2,
} as const;

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export const PRIORITY_ORDER = {
  [PRIORITY_LEVELS.HIGH]: 3,
  [PRIORITY_LEVELS.MEDIUM]: 2,
  [PRIORITY_LEVELS.LOW]: 1,
} as const;