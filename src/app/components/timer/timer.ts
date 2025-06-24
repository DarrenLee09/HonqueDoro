import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

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

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  estimatedPomodoros: number;
  completedPomodoros: number;
  priority: 'low' | 'medium' | 'high';
  category?: string;
}

@Component({
  selector: 'app-timer',
  imports: [CommonModule, FormsModule],
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

  // Task management signals
  tasks = signal<Task[]>([]);
  showTaskForm = signal(false);
  newTaskTitle = signal('');
  newTaskDescription = signal('');
  newTaskEstimatedPomodoros = signal(1);
  newTaskPriority = signal<'low' | 'medium' | 'high'>('medium');
  newTaskCategory = signal('');
  selectedTaskId = signal<string | undefined>(undefined);
  showCompletedTasks = signal(false);

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

  // Task computed values
  activeTasks = computed(() => {
    return this.tasks().filter(task => !task.completed);
  });

  completedTasks = computed(() => {
    return this.tasks().filter(task => task.completed);
  });

  visibleTasks = computed(() => {
    return this.showCompletedTasks() ? this.tasks() : this.activeTasks();
  });

  selectedTask = computed(() => {
    const taskId = this.selectedTaskId();
    return taskId ? this.tasks().find(task => task.id === taskId) : undefined;
  });

  totalTasks = computed(() => this.tasks().length);
  completedTasksCount = computed(() => this.completedTasks().length);
  activeTasksCount = computed(() => this.activeTasks().length);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.checkActiveSession();
    this.startSyncTimer();
    this.loadTasksFromStorage();
  }

  ngOnDestroy() {
    this.stopTimer();
    this.stopSync();
  }

  // Task management methods
  addTask(): void {
    if (!this.newTaskTitle().trim()) return;

    const newTask: Task = {
      id: this.generateTaskId(),
      title: this.newTaskTitle().trim(),
      description: this.newTaskDescription().trim() || undefined,
      completed: false,
      createdAt: new Date(),
      estimatedPomodoros: this.newTaskEstimatedPomodoros(),
      completedPomodoros: 0,
      priority: this.newTaskPriority(),
      category: this.newTaskCategory().trim() || undefined
    };

    this.tasks.update(tasks => [newTask, ...tasks]);
    this.saveTasksToStorage();
    this.resetTaskForm();
  }

  toggleTaskComplete(taskId: string): void {
    this.tasks.update(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              completed: !task.completed,
              completedAt: !task.completed ? new Date() : undefined
            }
          : task
      )
    );
    this.saveTasksToStorage();
  }

  deleteTask(taskId: string): void {
    this.tasks.update(tasks => tasks.filter(task => task.id !== taskId));
    this.saveTasksToStorage();
    
    if (this.selectedTaskId() === taskId) {
      this.selectedTaskId.set(undefined);
    }
  }

  selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  updateTaskPomodoros(taskId: string, increment: boolean): void {
    this.tasks.update(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              completedPomodoros: increment 
                ? Math.min(task.completedPomodoros + 1, task.estimatedPomodoros)
                : Math.max(task.completedPomodoros - 1, 0)
            }
          : task
      )
    );
    this.saveTasksToStorage();
  }

  resetTaskForm(): void {
    this.newTaskTitle.set('');
    this.newTaskDescription.set('');
    this.newTaskEstimatedPomodoros.set(1);
    this.newTaskPriority.set('medium');
    this.newTaskCategory.set('');
    this.showTaskForm.set(false);
  }

  toggleTaskForm(): void {
    this.showTaskForm.update(show => !show);
  }

  toggleCompletedTasks(): void {
    this.showCompletedTasks.update(show => !show);
  }

  private generateTaskId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadTasksFromStorage(): void {
    try {
      const stored = localStorage.getItem('honquedoro-tasks');
      if (stored) {
        const tasks = JSON.parse(stored).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }));
        this.tasks.set(tasks);
      }
    } catch (error) {
      console.error('Error loading tasks from storage:', error);
    }
  }

  private saveTasksToStorage(): void {
    try {
      localStorage.setItem('honquedoro-tasks', JSON.stringify(this.tasks()));
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
    }
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
    try {
      if (this.activeSessionId()) {
        // Cancel active session on backend
        await this.http.delete(`${this.apiUrl}/${this.activeSessionId()}`).toPromise();
      }
      
      this.stopTimer();
      this.currentTime.set(this.getCurrentModeDuration());
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
    } catch (error) {
      console.error('Error resetting timer:', error);
      // Fallback to local reset
      this.stopTimer();
      this.currentTime.set(this.getCurrentModeDuration());
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
    }
  }

  async skipTimer(): Promise<void> {
    try {
      if (this.activeSessionId()) {
        // Complete the session early on backend
        await this.http.post(`${this.apiUrl}/${this.activeSessionId()}/complete`, {}).toPromise();
      }
      
      this.stopTimer();
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      this.isRunning.set(false);
      
      // Use the same logic as completeSession
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
      
      // Play notification sound
      this.playNotificationSound();
    } catch (error) {
      console.error('Error skipping timer:', error);
      // Fallback to local skip
      this.stopTimer();
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      this.isRunning.set(false);
      
      // Use the same logic as completeSession
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
      
      // Play notification sound
      this.playNotificationSound();
    }
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
