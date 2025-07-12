import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface ActiveSession {
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
  private readonly apiUrl = 'http://localhost:5116/api/sessions'; // Backend API URL
  
  // Timer configuration (in seconds)
  private readonly workDuration = 25 * 60; // 25 minutes
  private readonly shortBreakDuration = 5 * 60; // 5 minutes
  private readonly longBreakDuration = 15 * 60; // 15 minutes
  private readonly sessionsUntilLongBreak = 4;

  // Signals for reactive state management
  isRunning = signal(false);
  currentTime = signal(this.workDuration);
  mode = signal<'work' | 'shortBreak' | 'longBreak'>('work');
  completedSessions = signal(0); // Total work sessions completed (all time)
  completedToday = signal(0); // Long breaks completed (resets daily)
  totalSessions = signal(0); // Total work sessions (same as completedSessions for now)
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
  completingTaskId = signal<string | undefined>(undefined); // For animation tracking
  
  // Task editing signals
  editingTaskId = signal<string | undefined>(undefined);
  editTaskTitle = signal('');
  editTaskDescription = signal('');
  editTaskEstimatedPomodoros = signal(1);
  editTaskPriority = signal<'low' | 'medium' | 'high'>('medium');
  editTaskCategory = signal('');

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
    const workSessionsSinceLongBreak = this.completedSessions() - (this.completedToday() * this.sessionsUntilLongBreak);
    return Math.max(0, this.sessionsUntilLongBreak - workSessionsSinceLongBreak);
  });

  // Task computed values
  activeTasks = computed(() => {
    return this.tasks().filter(task => !task.completed);
  });

  completedTasks = computed(() => {
    return this.tasks().filter(task => task.completed);
  });

  sortedTasks = computed(() => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return this.tasks().sort((a, b) => {
      // First sort by priority (high to low)
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  visibleTasks = computed(() => {
    const tasks = this.showCompletedTasks() ? this.sortedTasks() : this.sortedTasks().filter(task => !task.completed);
    return tasks;
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
    console.log('Timer ngOnInit running in', typeof window !== 'undefined' ? 'browser' : 'server');
    
    // Clear any stale session state to start fresh
    this.activeSessionId.set(undefined);
    this.serverSync.set(false);
    this.isRunning.set(false);
    
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
    console.log('addTask called with title:', this.newTaskTitle());
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

    console.log('Creating new task:', newTask);
    this.tasks.update(tasks => [newTask, ...tasks]);
    console.log('Tasks after adding:', this.tasks());
    this.saveTasksToStorage();
    this.resetTaskForm();
  }

  toggleTaskComplete(taskId: string): void {
    console.log('toggleTaskComplete called for taskId:', taskId);
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
    console.log('deleteTask called for taskId:', taskId);
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

  // Task editing methods
  startEditTask(taskId: string): void {
    console.log('startEditTask called for taskId:', taskId);
    const task = this.tasks().find(t => t.id === taskId);
    if (!task) {
      console.log('Task not found:', taskId);
      return;
    }

    console.log('Found task to edit:', task);
    this.editingTaskId.set(taskId);
    this.editTaskTitle.set(task.title);
    this.editTaskDescription.set(task.description || '');
    this.editTaskEstimatedPomodoros.set(task.estimatedPomodoros);
    this.editTaskPriority.set(task.priority);
    this.editTaskCategory.set(task.category || '');
    console.log('Edit form should now be visible');
  }

  saveEditTask(): void {
    const taskId = this.editingTaskId();
    if (!taskId || !this.editTaskTitle().trim()) return;

    this.tasks.update(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? {
              ...task,
              title: this.editTaskTitle().trim(),
              description: this.editTaskDescription().trim() || undefined,
              estimatedPomodoros: this.editTaskEstimatedPomodoros(),
              priority: this.editTaskPriority(),
              category: this.editTaskCategory().trim() || undefined
            }
          : task
      )
    );

    this.saveTasksToStorage();
    this.cancelEditTask();
  }

  cancelEditTask(): void {
    this.editingTaskId.set(undefined);
    this.editTaskTitle.set('');
    this.editTaskDescription.set('');
    this.editTaskEstimatedPomodoros.set(1);
    this.editTaskPriority.set('medium');
    this.editTaskCategory.set('');
  }

  isEditingTask(taskId: string): boolean {
    return this.editingTaskId() === taskId;
  }



  private generateTaskId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadTasksFromStorage(): void {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    if (!isBrowser) return;
    try {
      const stored = localStorage.getItem('honquedoro-tasks');
      console.log('Loading tasks from storage:', stored);
      if (stored) {
        const tasks = JSON.parse(stored).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }));
        console.log('Parsed tasks:', tasks);
        this.tasks.set(tasks);
      } else {
        console.log('No tasks found in storage');
      }
    } catch (error) {
      console.error('Error loading tasks from storage:', error);
    }
  }

  private saveTasksToStorage(): void {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    if (!isBrowser) return;
    try {
      localStorage.setItem('honquedoro-tasks', JSON.stringify(this.tasks()));
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
    }
  }

  async startTimer(): Promise<void> {
    try {
      if (this.activeSessionId()) {
        // Resume existing session
        const response = await this.http.post<ActiveSession>(
          `${this.apiUrl}/resume/${this.activeSessionId()}`, {}
        ).toPromise();
        
        if (response) {
          this.updateStateFromSession(response);
          // Always start local timer when resuming (user explicitly clicked start)
          this.startLocalTimer();
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
          // Always start local timer when starting new session (user explicitly clicked start)
          this.startLocalTimer();
        }
      }
    } catch (error) {
      console.error('Error with backend, continuing in local mode:', error);
      this.serverSync.set(false);
      
      // If we get a 400 error, it might mean the session state is out of sync
      // Clear the active session ID and start fresh
      if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
        console.log('Session state out of sync, clearing and starting fresh');
        this.activeSessionId.set(undefined);
        this.serverSync.set(false);
      }
      
      // Fallback to local timer only if backend fails
      this.startLocalTimer();
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
        // Update session data but ensure timer is paused
        this.currentTime.set(response.remainingSeconds);
        this.mode.set(this.mapSessionTypeToMode(response.type));
        this.serverSync.set(true);
        
        if (response.estimatedEndTime) {
          this.estimatedEndTime.set(new Date(response.estimatedEndTime));
        }
      }
      
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
    } catch (error) {
      console.error('Error pausing timer:', error);
      
      // If we get a 400 error, it might mean the session state is out of sync
      // Clear the active session ID and fall back to local mode
      if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
        console.log('Session state out of sync during pause, clearing and using local mode');
        this.activeSessionId.set(undefined);
        this.serverSync.set(false);
      }
      
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
      this.isRunning.set(false); // Ensure timer is stopped
      this.currentTime.set(this.getCurrentModeDuration());
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
    } catch (error) {
      console.error('Error resetting timer:', error);
      // Fallback to local reset
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
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
        await this.http.post(`${this.apiUrl}/complete/${this.activeSessionId()}`, {}).toPromise();
      }
      
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      
      // Use the same logic as completeSession
      if (this.mode() === 'work') {
        // Work session completed - increment work session counters
        this.completedSessions.update(sessions => sessions + 1);
        this.totalSessions.update(sessions => sessions + 1);
        
        // Auto-increment Pomodoro count for selected task
        this.autoIncrementTaskPomodoros();
        
        // Check if we need a long break (every 4 work sessions)
        const workSessionsSinceLongBreak = this.completedSessions() - (this.completedToday() * this.sessionsUntilLongBreak);
        if (workSessionsSinceLongBreak >= this.sessionsUntilLongBreak) {
          // Time for a long break
          this.mode.set('longBreak');
          this.currentTime.set(this.longBreakDuration);
        } else {
          // Take a short break
          this.mode.set('shortBreak');
          this.currentTime.set(this.shortBreakDuration);
        }
      } else if (this.mode() === 'longBreak') {
        // Long break completed - increment completedToday and go to work
        this.completedToday.update(breaks => breaks + 1);
        this.mode.set('work');
        this.currentTime.set(this.workDuration);
      } else {
        // Short break completed - go to work
        this.mode.set('work');
        this.currentTime.set(this.workDuration);
      }
      
      // Play notification sound
      this.playNotificationSound();
    } catch (error) {
      console.error('Error skipping timer:', error);
      // Fallback to local skip
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      
      // Use the same logic as completeSession
      if (this.mode() === 'work') {
        // Work session completed - increment work session counters
        this.completedSessions.update(sessions => sessions + 1);
        this.totalSessions.update(sessions => sessions + 1);
        
        // Auto-increment Pomodoro count for selected task
        this.autoIncrementTaskPomodoros();
        
        // Check if we need a long break (every 4 work sessions)
        const workSessionsSinceLongBreak = this.completedSessions() - (this.completedToday() * this.sessionsUntilLongBreak);
        if (workSessionsSinceLongBreak >= this.sessionsUntilLongBreak) {
          // Time for a long break
          this.mode.set('longBreak');
          this.currentTime.set(this.longBreakDuration);
        } else {
          // Take a short break
          this.mode.set('shortBreak');
          this.currentTime.set(this.shortBreakDuration);
        }
      } else if (this.mode() === 'longBreak') {
        // Long break completed - increment completedToday and go to work
        this.completedToday.update(breaks => breaks + 1);
        this.mode.set('work');
        this.currentTime.set(this.workDuration);
      } else {
        // Short break completed - go to work
        this.mode.set('work');
        this.currentTime.set(this.workDuration);
      }
      
      // Play notification sound
      this.playNotificationSound();
    }
  }

  private async checkActiveSession(): Promise<void> {
    console.log('checkActiveSession called in', typeof window !== 'undefined' ? 'browser' : 'server');
    try {
      const response = await this.http.get<TimerState>(`${this.apiUrl}/active`).toPromise();
      this.serverSync.set(true); // Set to true on any successful response
      if (response?.hasActiveSession && response.activeSession) {
        this.activeSessionId.set(response.activeSession.id);
        this.updateStateFromSession(response.activeSession);
        // Don't auto-start the timer - let the user control it
      }
    } catch (error) {
      this.serverSync.set(false);
      console.error('Error checking active session:', error);
    }
  }

  private updateStateFromSession(session: ActiveSession): void {
    this.currentTime.set(session.remainingSeconds);
    // Don't automatically set isRunning based on session status
    // Let the user control start/pause through the UI
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
    this.isRunning.set(false); // Ensure timer is stopped
    
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
      // Work session completed - increment work session counters
      this.completedSessions.update(sessions => sessions + 1);
      this.totalSessions.update(sessions => sessions + 1);
      
      // Auto-increment Pomodoro count for selected task
      this.autoIncrementTaskPomodoros();
      
      // Check if we need a long break (every 4 work sessions)
      const workSessionsSinceLongBreak = this.completedSessions() - (this.completedToday() * this.sessionsUntilLongBreak);
      if (workSessionsSinceLongBreak >= this.sessionsUntilLongBreak) {
        // Time for a long break
        this.mode.set('longBreak');
        this.currentTime.set(this.longBreakDuration);
      } else {
        // Take a short break
        this.mode.set('shortBreak');
        this.currentTime.set(this.shortBreakDuration);
      }
    } else if (this.mode() === 'longBreak') {
      // Long break completed - increment completedToday and go to work
      this.completedToday.update(breaks => breaks + 1);
      this.mode.set('work');
      this.currentTime.set(this.workDuration);
    } else {
      // Short break completed - go to work
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

  private mapSessionTypeToMode(type: string | number): 'work' | 'shortBreak' | 'longBreak' {
    // Handle both string and number types from backend
    if (typeof type === 'number') {
      switch (type) {
        case 0: return 'work';
        case 1: return 'shortBreak';
        case 2: return 'longBreak';
        default: return 'work';
      }
    } else {
      // Handle string type
      switch (type.toLowerCase()) {
        case 'work': return 'work';
        case 'shortbreak': return 'shortBreak';
        case 'longbreak': return 'longBreak';
        default: return 'work';
      }
    }
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio();
      audio.src = 'assets/sounds/honk.mp3';
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

  // Auto-increment Pomodoro count for selected task when work session completes
  private autoIncrementTaskPomodoros(): void {
    const selectedTask = this.selectedTask();
    if (selectedTask && !selectedTask.completed && this.mode() === 'work') {
      this.updateTaskPomodoros(selectedTask.id, true);
      
      // Check if task should be auto-completed
      if (selectedTask.completedPomodoros + 1 >= selectedTask.estimatedPomodoros) {
        this.autoCompleteTask(selectedTask.id);
      }
    }
  }

  // Auto-complete task with animation
  private autoCompleteTask(taskId: string): void {
    this.completingTaskId.set(taskId);
    
    // Delay the actual completion to allow for animation
    setTimeout(() => {
      this.toggleTaskComplete(taskId);
      this.completingTaskId.set(undefined);
    }, 500);
  }
}
