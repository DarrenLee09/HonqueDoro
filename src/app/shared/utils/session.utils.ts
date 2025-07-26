import { TimerMode, SessionType } from '../types';
import { SESSION_TYPES } from '../constants/app-constants';

/**
 * Maps timer mode to session type for API calls
 */
export function mapModeToSessionType(mode: TimerMode): SessionType {
  switch (mode) {
    case 'work': return SESSION_TYPES.WORK;
    case 'shortBreak': return SESSION_TYPES.SHORT_BREAK;
    case 'longBreak': return SESSION_TYPES.LONG_BREAK;
    default: return SESSION_TYPES.WORK;
  }
}

/**
 * Maps session type from API to timer mode
 */
export function mapSessionTypeToMode(type: string | number): TimerMode {
  // Handle null/undefined safely
  if (type == null) return 'work';
  
  // Handle both string and number types from backend
  if (typeof type === 'number') {
    switch (type) {
      case SESSION_TYPES.WORK: return 'work';
      case SESSION_TYPES.SHORT_BREAK: return 'shortBreak';
      case SESSION_TYPES.LONG_BREAK: return 'longBreak';
      default: return 'work';
    }
  } else if (typeof type === 'string') {
    // Handle string type with null safety
    switch (type.toLowerCase()) {
      case 'work': return 'work';
      case 'shortbreak': return 'shortBreak';
      case 'longbreak': return 'longBreak';
      default: return 'work';
    }
  }
  
  // Fallback for unexpected types
  return 'work';
}

/**
 * Determines if a long break is needed based on completed sessions
 */
export function needsLongBreak(completedSessions: number, sessionsUntilLongBreak: number): boolean {
  // Don't suggest long break if no sessions completed yet
  if (completedSessions === 0) return false;
  return completedSessions % sessionsUntilLongBreak === 0;
}

/**
 * Calculates remaining sessions until next long break
 */
export function remainingSessionsUntilLongBreak(completedSessions: number, sessionsUntilLongBreak: number): number {
  const sessionsSinceLastLongBreak = completedSessions % sessionsUntilLongBreak;
  return sessionsSinceLastLongBreak === 0 ? sessionsUntilLongBreak : sessionsUntilLongBreak - sessionsSinceLastLongBreak;
}