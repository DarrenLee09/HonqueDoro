export interface ActiveSession {
  id: number;
  type: string | number;
  status: string;
  durationMinutes: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  estimatedEndTime?: string;
  progressPercentage: number;
  startTime: string;
  lastUpdated?: string;
  notes?: string;
}

export interface TimerState {
  hasActiveSession: boolean;
  activeSession?: ActiveSession;
  message?: string;
}

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';
export type SessionStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type SessionType = 0 | 1 | 2; // work, shortBreak, longBreak