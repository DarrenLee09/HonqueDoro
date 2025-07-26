import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SessionRecord {
  date: Date;
  type: 'Work' | 'Break';
  duration: number;
  taskId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionTrackingService {
  private readonly storageKey = 'honquedoro-session-history';
  
  // Signal for reactive updates
  private sessionsSignal = signal<SessionRecord[]>([]);
  
  // BehaviorSubject for components that prefer observables
  private sessionsSubject = new BehaviorSubject<SessionRecord[]>([]);
  
  constructor() {
    this.loadSessions();
  }

  /**
   * Add a completed session to tracking
   */
  addSession(session: SessionRecord): void {
    const currentSessions = this.sessionsSignal();
    const updatedSessions = [session, ...currentSessions];
    
    this.sessionsSignal.set(updatedSessions);
    this.sessionsSubject.next(updatedSessions);
    this.saveSessions();
  }

  /**
   * Get all sessions as a signal (reactive)
   */
  getSessions() {
    return this.sessionsSignal.asReadonly();
  }

  /**
   * Get sessions as observable
   */
  getSessions$() {
    return this.sessionsSubject.asObservable();
  }

  /**
   * Get sessions for a specific date
   */
  getSessionsForDate(date: Date): SessionRecord[] {
    return this.sessionsSignal().filter(session => 
      this.isSameDay(session.date, date)
    );
  }

  /**
   * Get sessions for current week
   */
  getWeeklySessions(): SessionRecord[] {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return this.sessionsSignal().filter(session => 
      session.date >= startOfWeek && session.date <= endOfWeek
    );
  }

  /**
   * Get sessions for current month
   */
  getMonthlySessions(): SessionRecord[] {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return this.sessionsSignal().filter(session => 
      session.date >= startOfMonth && session.date <= endOfMonth
    );
  }

  /**
   * Get work sessions count for today
   */
  getTodayWorkSessions(): number {
    const today = new Date();
    return this.getSessionsForDate(today).filter(s => s.type === 'Work').length;
  }

  /**
   * Clear all session history
   */
  clearAllSessions(): void {
    this.sessionsSignal.set([]);
    this.sessionsSubject.next([]);
    this.saveSessions();
  }

  /**
   * Load sessions from localStorage
   */
  private loadSessions(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const sessions = JSON.parse(saved).map((s: any) => ({
          ...s,
          date: new Date(s.date)
        }));
        this.sessionsSignal.set(sessions);
        this.sessionsSubject.next(sessions);
      }
    } catch (error) {
      console.warn('Failed to load session history:', error);
    }
  }

  /**
   * Save sessions to localStorage
   */
  private saveSessions(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.sessionsSignal()));
    } catch (error) {
      console.warn('Failed to save session history:', error);
    }
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}