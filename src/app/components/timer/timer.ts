import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PomodoroState {
  isRunning: boolean;
  currentTime: number;
  mode: 'work' | 'shortBreak' | 'longBreak';
  completedSessions: number;
  totalSessions: number;
}

@Component({
  selector: 'app-timer',
  imports: [CommonModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css'
})
export class Timer implements OnInit, OnDestroy {
  private intervalId: any = null;
  
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
    totalSessions: 0
  };

  ngOnInit() {
    this.resetTimer();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  startTimer(): void {
    if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);
    }
  }

  pauseTimer(): void {
    this.state.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetTimer(): void {
    this.pauseTimer();
    this.state.currentTime = this.getCurrentModeDuration();
  }

  private tick(): void {
    if (this.state.currentTime > 0) {
      this.state.currentTime--;
    } else {
      this.completeSession();
    }
  }

  private completeSession(): void {
    this.pauseTimer();
    
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

    // Auto-start next session (optional)
    this.playNotificationSound();
  }

  getCurrentModeDuration(): number {
    switch (this.state.mode) {
      case 'work': return this.workDuration;
      case 'shortBreak': return this.shortBreakDuration;
      case 'longBreak': return this.longBreakDuration;
      default: return this.workDuration;
    }
  }

  private playNotificationSound(): void {
    // Notification for session completion
    try {
      // Use a short beep sound or browser notification
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ4AAAA=';
      audio.play();
    } catch (error) {
      // Fallback: just log to console if audio fails
      console.log('🔔 Session completed!');
    }
  }

  // Utility methods for display
  get formattedTime(): string {
    const minutes = Math.floor(this.state.currentTime / 60);
    const seconds = this.state.currentTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  get progressPercentage(): number {
    const totalTime = this.getCurrentModeDuration();
    const elapsed = totalTime - this.state.currentTime;
    return (elapsed / totalTime) * 100;
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
}
