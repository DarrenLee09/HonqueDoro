import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
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

  // Signals for reactive state management
  isRunning = signal(false);
  currentTime = signal(this.workDuration);
  mode = signal<'work' | 'shortBreak' | 'longBreak'>('work');
  completedSessions = signal(0);
  totalSessions = signal(0);
  activeSessionId = signal<number | undefined>(undefined);
  estimatedEndTime = signal<Date | undefined>(undefined);
  serverSync = signal(false);

  // Computed values
  formattedTime = computed(() => {
    const totalSeconds = Math.floor(this.currentTime());
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  formattedETA = computed(() => {
    const eta = this.estimatedEndTime();
    if (!eta) return '';
    
    return eta.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  });

  progressPercentage = computed(() => {
    const totalTime = this.getCurrentModeDuration();
    const elapsed = totalTime - this.currentTime();
    const percentage = (elapsed / totalTime) * 100;
    return Math.min(100, Math.max(0, percentage));
  });

  modeDisplayName = computed(() => {
    switch (this.mode()) {
      case 'work': return 'Work Session';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
      default: return 'Work Session';
    }
  });

  modeIcon = computed(() => {
    switch (this.mode()) {
      case 'work': return '🍅';
      case 'shortBreak': return '☕';
      case 'longBreak': return '🌴';
      default: return '🍅';
    }
  });

  statusIndicator = computed(() => {
    if (this.serverSync()) {
      return this.isRunning() ? '🟢 Active' : '⏸️ Paused';
    } else {
      return '🔄 Local Mode';
    }
  });

  remainingSessionsUntilLongBreak = computed(() => {
    return this.sessionsUntilLongBreak - (this.completedSessions() % this.sessionsUntilLongBreak);
  });

  constructor(private http: HttpClient) {}

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
      if (this.activeSessionId()) {
        // Resume existing session
        const response = await this.http.post<ActiveSession>(
          `${this.apiUrl}/resume/${this.activeSessionId()}`, {}
        ).toPromise();
        
        if (response) {
          this.updateStateFromSession(response);
        }
      } else {
        // Start new session
        const sessionType = this.mapModeToSessionType(this.mode());
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
          this.activeSessionId.set(response.id);
          this.updateStateFromSession(response);
        }
      }
    } catch (error) {
      console.error('Error with backend, continuing in local mode:', error);
      this.serverSync.set(false);
    }
  }

  async pauseTimer(): Promise<void> {
    if (!this.activeSessionId()) {
      this.pauseLocalTimer();
      return;
    }

    try {
      const response = await this.http.post<ActiveSession>(
        `${this.apiUrl}/pause/${this.activeSessionId()}`, {}
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
    if (this.activeSessionId()) {
      try {
        await this.http.delete(`${this.apiUrl}/cancel/${this.activeSessionId()}`).toPromise();
        this.activeSessionId.set(undefined);
      } catch (error) {
        console.error('Error cancelling session:', error);
      }
    }
    
    this.stopTimer();
    this.currentTime.set(this.getCurrentModeDuration());
    this.isRunning.set(false);
    this.estimatedEndTime.set(undefined);
  }

  private async checkActiveSession(): Promise<void> {
    try {
      const response = await this.http.get<TimerState>(`${this.apiUrl}/active`).toPromise();
      
      if (response?.hasActiveSession && response.activeSession) {
        this.activeSessionId.set(response.activeSession.id);
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
    this.currentTime.set(session.remainingSeconds);
    this.isRunning.set(session.status === 'Active');
    this.mode.set(this.mapSessionTypeToMode(session.type));
    this.serverSync.set(true);
    
    if (session.estimatedEndTime) {
      this.estimatedEndTime.set(new Date(session.estimatedEndTime));
    }
  }

  private startLocalTimer(): void {
    this.isRunning.set(true);
    this.updateEstimatedEndTime();
    this.timerSubscription = interval(1000).subscribe(() => {
      this.tick();
    });
  }

  private startLocalTimerFallback(): void {
    // Fallback to local timer if backend is unavailable
    this.serverSync.set(false);
    this.startLocalTimer();
  }

  private pauseLocalTimer(): void {
    this.isRunning.set(false);
    this.stopTimer();
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
      if (this.activeSessionId()) {
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
    if (this.currentTime() > 0) {
      this.currentTime.update(time => time - 1);
      this.updateEstimatedEndTime();
    } else {
      this.completeSession();
    }
  }

  private updateEstimatedEndTime(): void {
    if (this.isRunning() && this.currentTime() > 0) {
      this.estimatedEndTime.set(new Date(Date.now() + (this.currentTime() * 1000)));
    }
  }

  private async completeSession(): Promise<void> {
    this.stopTimer();
    
    if (this.activeSessionId()) {
      try {
        await this.http.post(`${this.apiUrl}/complete/${this.activeSessionId()}`, {
          completedAt: new Date().toISOString(),
          notes: null
        }).toPromise();
        
        this.activeSessionId.set(undefined);
      } catch (error) {
        console.error('Error completing session:', error);
      }
    }
    
    if (this.mode() === 'work') {
      this.completedSessions.update(sessions => sessions + 1);
      this.totalSessions.update(sessions => sessions + 1);
      
      // Determine next mode
      if (this.completedSessions() % this.sessionsUntilLongBreak === 0) {
        this.mode.set('longBreak');
        this.currentTime.set(this.longBreakDuration);
      } else {
        this.mode.set('shortBreak');
        this.currentTime.set(this.shortBreakDuration);
      }
    } else {
      // Break finished, start work session
      this.mode.set('work');
      this.currentTime.set(this.workDuration);
    }

    this.playNotificationSound();
    this.estimatedEndTime.set(undefined);
  }

  getCurrentModeDuration(): number {
    switch (this.mode()) {
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

  formatElapsedTime(): string {
    const totalSeconds = this.getCurrentModeDuration();
    const elapsed = Math.floor(totalSeconds - this.currentTime());
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  async changeMode(mode: 'work' | 'shortBreak' | 'longBreak'): Promise<void> {
    if (this.isRunning()) return; // Don't allow mode change while running
    
    await this.resetTimer(); // Reset any active session
    this.mode.set(mode);
    this.currentTime.set(this.getCurrentModeDuration());
    this.estimatedEndTime.set(undefined);
  }
}
