import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';

interface ActiveSession {
  id: number;
  type: string;
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

interface TimerState {
  hasActiveSession: boolean;
  activeSession?: ActiveSession;
  message?: string;
}

interface PomodoroState {
  isRunning: boolean;
  currentTime: number;
  mode: 'work' | 'shortBreak' | 'longBreak';
  completedSessions: number;
  totalSessions: number;
  activeSessionId?: number;
  estimatedEndTime?: Date;
  serverSync: boolean;
}

@Component({
  selector: 'app-timer',
  imports: [CommonModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css'
})
export class Timer implements OnInit, OnDestroy {
  private timerSubscription?: Subscription;
  private syncSubscription?: Subscription;
  private readonly apiUrl = 'http://localhost:5117/api/sessions'; // Backend API URL
  
  // Timer configuration (in seconds)
  private readonly workDuration = 25 * 60; // 25 minutes
  private readonly shortBreakDuration = 5 * 60; // 5 minutes
  private readonly longBreakDuration = 15 * 60; // 15 minutes
  private readonly sessionsUntilLongBreak = 4;

  state: PomodoroState = {
    isRunning: false,
    currentTime: this.workDuration,
    mode: 'work',
    completedSessions: 0,
    totalSessions: 0,
    serverSync: false
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.checkActiveSession();
    this.startSyncTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
    this.stopSync();
  }

  async startTimer(): Promise<void> {
    // Start local timer immediately for smooth animation
    this.startLocalTimer();
    
    try {
      if (this.state.activeSessionId) {
        // Resume existing session
        const response = await this.http.post<ActiveSession>(
          `${this.apiUrl}/resume/${this.state.activeSessionId}`, {}
        ).toPromise();
        
        if (response) {
          this.updateStateFromSession(response);
        }
      } else {
        // Start new session
        const sessionType = this.mapModeToSessionType(this.state.mode);
        const duration = Math.floor(this.getCurrentModeDuration() / 60);
        
        const response = await this.http.post<ActiveSession>(
          `${this.apiUrl}/start`,
          {
            type: sessionType,
            durationMinutes: duration,
            notes: null
          }
        ).toPromise();

        if (response) {
          this.state.activeSessionId = response.id;
          this.updateStateFromSession(response);
        }
      }
    } catch (error) {
      console.error('Error with backend, continuing in local mode:', error);
      this.state.serverSync = false;
    }
  }

  async pauseTimer(): Promise<void> {
    if (!this.state.activeSessionId) {
      this.pauseLocalTimer();
      return;
    }

    try {
      const response = await this.http.post<ActiveSession>(
        `${this.apiUrl}/pause/${this.state.activeSessionId}`, {}
      ).toPromise();
      
      if (response) {
        this.updateStateFromSession(response);
      }
      
      this.stopTimer();
    } catch (error) {
      console.error('Error pausing timer:', error);
      this.pauseLocalTimer();
    }
  }

  async resetTimer(): Promise<void> {
    if (this.state.activeSessionId) {
      try {
        await this.http.delete(`${this.apiUrl}/cancel/${this.state.activeSessionId}`).toPromise();
        this.state.activeSessionId = undefined;
      } catch (error) {
        console.error('Error cancelling session:', error);
      }
    }
    
    this.stopTimer();
    this.state.currentTime = this.getCurrentModeDuration();
    this.state.isRunning = false;
    this.state.estimatedEndTime = undefined;
    this.cdr.detectChanges();
  }

  private async checkActiveSession(): Promise<void> {
    try {
      const response = await this.http.get<TimerState>(`${this.apiUrl}/active`).toPromise();
      
      if (response?.hasActiveSession && response.activeSession) {
        this.state.activeSessionId = response.activeSession.id;
        this.updateStateFromSession(response.activeSession);
        
        if (response.activeSession.status === 'Active') {
          this.startLocalTimer();
        }
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  }

  private updateStateFromSession(session: ActiveSession): void {
    this.state.currentTime = session.remainingSeconds;
    this.state.isRunning = session.status === 'Active';
    this.state.mode = this.mapSessionTypeToMode(session.type);
    this.state.serverSync = true;
    
    if (session.estimatedEndTime) {
      this.state.estimatedEndTime = new Date(session.estimatedEndTime);
    }
    
    this.cdr.detectChanges(); // Ensure UI updates when state changes
  }

  private startLocalTimer(): void {
    this.state.isRunning = true;
    this.updateEstimatedEndTime();
    this.timerSubscription = interval(1000).subscribe(() => {
      this.tick();
    });
  }

  private startLocalTimerFallback(): void {
    // Fallback to local timer if backend is unavailable
    this.state.serverSync = false;
    this.startLocalTimer();
  }

  private pauseLocalTimer(): void {
    this.state.isRunning = false;
    this.stopTimer();
    this.cdr.detectChanges();
  }

  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }

  private startSyncTimer(): void {
    // Sync with server every 10 seconds when session is active
    this.syncSubscription = interval(10000).subscribe(() => {
      if (this.state.activeSessionId) {
        this.checkActiveSession();
      }
    });
  }

  private stopSync(): void {
    if (this.syncSubscription) {
      this.syncSubscription.unsubscribe();
      this.syncSubscription = undefined;
    }
  }

  private tick(): void {
    if (this.state.currentTime > 0) {
      this.state.currentTime--;
      this.updateEstimatedEndTime();
      this.cdr.detectChanges(); // Force change detection on each tick
    } else {
      this.completeSession();
    }
  }

  private updateEstimatedEndTime(): void {
    if (this.state.isRunning && this.state.currentTime > 0) {
      this.state.estimatedEndTime = new Date(Date.now() + (this.state.currentTime * 1000));
    }
  }

  private async completeSession(): Promise<void> {
    this.stopTimer();
    
    if (this.state.activeSessionId) {
      try {
        await this.http.post(`${this.apiUrl}/complete/${this.state.activeSessionId}`, {
          completedAt: new Date().toISOString(),
          notes: null
        }).toPromise();
        
        this.state.activeSessionId = undefined;
      } catch (error) {
        console.error('Error completing session:', error);
      }
    }
    
    if (this.state.mode === 'work') {
      this.state.completedSessions++;
      this.state.totalSessions++;
      
      // Determine next mode
      if (this.state.completedSessions % this.sessionsUntilLongBreak === 0) {
        this.state.mode = 'longBreak';
        this.state.currentTime = this.longBreakDuration;
      } else {
        this.state.mode = 'shortBreak';
        this.state.currentTime = this.shortBreakDuration;
      }
    } else {
      // Break finished, start work session
      this.state.mode = 'work';
      this.state.currentTime = this.workDuration;
    }

    this.playNotificationSound();
    this.state.estimatedEndTime = undefined;
    this.cdr.detectChanges(); // Ensure UI updates when session completes
  }

  getCurrentModeDuration(): number {
    switch (this.state.mode) {
      case 'work': return this.workDuration;
      case 'shortBreak': return this.shortBreakDuration;
      case 'longBreak': return this.longBreakDuration;
      default: return this.workDuration;
    }
  }

  private mapModeToSessionType(mode: string): number {
    switch (mode) {
      case 'work': return 0; // SessionType.Work
      case 'shortBreak': return 1; // SessionType.ShortBreak
      case 'longBreak': return 2; // SessionType.LongBreak
      default: return 0;
    }
  }

  private mapSessionTypeToMode(type: string): 'work' | 'shortBreak' | 'longBreak' {
    switch (type.toLowerCase()) {
      case 'work': return 'work';
      case 'shortbreak': return 'shortBreak';
      case 'longbreak': return 'longBreak';
      default: return 'work';
    }
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAA=';
      audio.play();
    } catch (error) {
      console.log('🔔 Session completed!');
    }
  }

  // Utility methods for display
  get formattedTime(): string {
    const totalSeconds = Math.floor(this.state.currentTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  get formattedETA(): string {
    if (!this.state.estimatedEndTime) return '';
    
    return this.state.estimatedEndTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  formatElapsedTime(): string {
    const totalSeconds = this.getCurrentModeDuration();
    const elapsed = Math.floor(totalSeconds - this.state.currentTime);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  get remainingSessionsUntilLongBreak(): number {
    return this.sessionsUntilLongBreak - (this.state.completedSessions % this.sessionsUntilLongBreak);
  }

  async changeMode(mode: 'work' | 'shortBreak' | 'longBreak'): Promise<void> {
    if (this.state.isRunning) return; // Don't allow mode change while running
    
    await this.resetTimer(); // Reset any active session
    this.state.mode = mode;
    this.state.currentTime = this.getCurrentModeDuration();
    this.state.estimatedEndTime = undefined;
    this.cdr.detectChanges(); // Ensure UI updates when mode changes
  }

  get progressPercentage(): number {
    const totalTime = this.getCurrentModeDuration();
    const elapsed = totalTime - this.state.currentTime;
    const percentage = (elapsed / totalTime) * 100;
    return Math.min(100, Math.max(0, percentage)); // Ensure it's between 0-100
  }

  get modeDisplayName(): string {
    switch (this.state.mode) {
      case 'work': return 'Work Session';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
      default: return 'Work Session';
    }
  }

  get modeIcon(): string {
    switch (this.state.mode) {
      case 'work': return '🍅';
      case 'shortBreak': return '☕';
      case 'longBreak': return '🌴';
      default: return '🍅';
    }
  }

  get statusIndicator(): string {
    if (this.state.serverSync) {
      return this.state.isRunning ? '🟢 Active' : '⏸️ Paused';
    } else {
      return '🔄 Local Mode';
    }
  }
}
