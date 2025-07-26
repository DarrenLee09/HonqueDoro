import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { interval, Subscription, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../shared/services/storage.service';
import { SessionTrackingService } from '../../shared/services/session-tracking.service';
import { ActiveSession, TimerState, Task, TimerMode, TaskPriority } from '../../shared/types';
import { API_CONFIG, TIMER_DURATIONS, PRIORITY_ORDER } from '../../shared/constants/app-constants';
import { formatTime, formatElapsedTime, calculateProgressPercentage, formatTimeString, calculateEstimatedEndTime } from '../../shared/utils/time.utils';
import { mapModeToSessionType, mapSessionTypeToMode, needsLongBreak, remainingSessionsUntilLongBreak } from '../../shared/utils/session.utils';


@Component({
  selector: 'app-timer',
  imports: [CommonModule, FormsModule],
  templateUrl: './timer.html',
  styleUrl: './timer.css'
})
export class Timer implements OnInit, OnDestroy {
  private timerSubscription?: Subscription;
  private syncSubscription?: Subscription;
  private pendingHttpRequests: Subscription[] = [];
  private readonly apiUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSIONS}`; // Backend API URL

  // Signals for reactive state management
  isRunning = signal(false);
  currentTime = signal(TIMER_DURATIONS.WORK);
  mode = signal<TimerMode>('work');
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
  newTaskPriority = signal<TaskPriority>('medium');
  newTaskCategory = signal('');
  selectedTaskId = signal<string | undefined>(undefined);
  showCompletedTasks = signal(false);
  completingTaskId = signal<string | undefined>(undefined); // For animation tracking
  
  // Task editing signals
  editingTaskId = signal<string | undefined>(undefined);
  editTaskTitle = signal('');
  editTaskDescription = signal('');
  editTaskEstimatedPomodoros = signal(1);
  editTaskPriority = signal<TaskPriority>('medium');
  editTaskCategory = signal('');

  // Computed values
  formattedTime = computed(() => {
    return formatTime(Math.floor(this.currentTime()));
  });

  formattedETA = computed(() => {
    const eta = this.estimatedEndTime();
    if (!eta) return '';
    return formatTimeString(eta);
  });

  progressPercentage = computed(() => {
    return calculateProgressPercentage(this.getCurrentModeDuration(), this.currentTime());
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
    return remainingSessionsUntilLongBreak(this.completedSessions(), TIMER_DURATIONS.SESSIONS_UNTIL_LONG_BREAK);
  });

  // Task computed values
  activeTasks = computed(() => {
    return this.tasks().filter(task => !task.completed);
  });

  completedTasks = computed(() => {
    return this.tasks().filter(task => task.completed);
  });

  sortedTasks = computed(() => {
    return this.tasks().sort((a, b) => {
      // First sort by pinned status (pinned tasks on top)
      if (a.pinned !== b.pinned) {
        return b.pinned ? 1 : -1;
      }
      
      // Then sort by priority (high to low)
      const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Finally sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  visibleTasks = computed(() => {
    const sortedTasks = this.sortedTasks();
    return this.showCompletedTasks() ? sortedTasks : sortedTasks.filter(task => !task.completed);
  });

  pinnedTask = computed(() => {
    return this.tasks().find(task => task.pinned && !task.completed);
  });

  selectedTask = computed(() => {
    const taskId = this.selectedTaskId();
    return taskId ? this.tasks().find(task => task.id === taskId) : undefined;
  });

  totalTasks = computed(() => this.tasks().length);
  completedTasksCount = computed(() => this.completedTasks().length);
  activeTasksCount = computed(() => this.activeTasks().length);

  constructor(
    private http: HttpClient, 
    private storageService: StorageService,
    private sessionTrackingService: SessionTrackingService
  ) {}

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
    // Cancel pending HTTP requests
    this.pendingHttpRequests.forEach(req => req.unsubscribe());
    this.pendingHttpRequests = [];
    // Clear any pending timeouts
    if (this.completingTaskId()) {
      this.completingTaskId.set(undefined);
    }
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
      category: this.newTaskCategory().trim() || undefined,
      pinned: false
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

  togglePinTask(taskId: string): void {
    this.tasks.update(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? { ...task, pinned: !task.pinned }
          : task
      )
    );
    this.saveTasksToStorage();
    
    // Set the pinned task as selected for work session
    const pinnedTask = this.tasks().find(task => task.id === taskId && task.pinned);
    if (pinnedTask) {
      this.selectedTaskId.set(taskId);
    } else if (this.selectedTaskId() === taskId) {
      this.selectedTaskId.set(undefined);
    }
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

  getTaskCompletionPercentage(task: Task): number {
    return (task.completedPomodoros / task.estimatedPomodoros) * 100;
  }



  private generateTaskId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private loadTasksFromStorage(): void {
    try {
      const tasks = this.storageService.getTasks<Task>();
      console.log('Loading tasks from storage:', tasks);
      
      // Map stored data to ensure proper types
      const mappedTasks = tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        pinned: task.pinned || false // Default to false for existing tasks
      }));
      
      console.log('Parsed tasks:', mappedTasks);
      this.tasks.set(mappedTasks);
    } catch (error) {
      console.error('Error loading tasks from storage:', error);
    }
  }

  private saveTasksToStorage(): void {
    try {
      this.storageService.saveTasks(this.tasks());
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
    }
  }

  async startTimer(): Promise<void> {
    try {
      if (this.activeSessionId()) {
        // Resume existing session
        const request$ = this.http.post<ActiveSession>(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RESUME(this.activeSessionId()!)}`, {}
        );
        const response = await firstValueFrom(request$);
        
        if (response) {
          this.updateStateFromSession(response);
          // Always start local timer when resuming (user explicitly clicked start)
          this.startLocalTimer();
        }
      } else {
        // Start new session
        const sessionType = mapModeToSessionType(this.mode());
        const duration = Math.floor(this.getCurrentModeDuration() / 60);
        
        const request$ = this.http.post<ActiveSession>(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSIONS}`,
          {
            type: sessionType,
            durationMinutes: duration,
            notes: null
          }
        );
        const response = await firstValueFrom(request$);

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
      if (error instanceof HttpErrorResponse && error.status === 400) {
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
      const response = await firstValueFrom(this.http.post<ActiveSession>(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PAUSE(this.activeSessionId()!)}`, {}
      ));
      
      if (response) {
        // Update session data but ensure timer is paused
        this.currentTime.set(response.remainingSeconds);
        this.mode.set(mapSessionTypeToMode(response.type));
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
      if (error instanceof HttpErrorResponse && error.status === 400) {
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
        await firstValueFrom(this.http.delete(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DELETE(this.activeSessionId()!)}`));
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
        await firstValueFrom(this.http.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COMPLETE(this.activeSessionId()!)}`, {}));
      }
      
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      
      // Use common session completion logic
      this.handleSessionCompletion();
    } catch (error) {
      console.error('Error skipping timer:', error);
      // Fallback to local skip
      this.stopTimer();
      this.isRunning.set(false); // Ensure timer is stopped
      this.activeSessionId.set(undefined);
      this.estimatedEndTime.set(undefined);
      this.serverSync.set(false);
      
      // Use common session completion logic
      this.handleSessionCompletion();
    }
  }

  private async checkActiveSession(): Promise<void> {
    console.log('checkActiveSession called in', typeof window !== 'undefined' ? 'browser' : 'server');
    
    // Skip sync if timer is actively running to avoid interrupting user
    if (this.isRunning()) {
      return;
    }
    
    try {
      const response = await firstValueFrom(this.http.get<TimerState>(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACTIVE}`));
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
    this.mode.set(mapSessionTypeToMode(session.type));
    this.serverSync.set(true);
    
    if (session.estimatedEndTime) {
      this.estimatedEndTime.set(new Date(session.estimatedEndTime));
    }
  }

  private startLocalTimer(): void {
    // Prevent multiple timer subscriptions
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
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
      this.estimatedEndTime.set(calculateEstimatedEndTime(this.currentTime()));
    }
  }

  private async completeSession(): Promise<void> {
    this.stopTimer();
    this.isRunning.set(false); // Ensure timer is stopped
    
    if (this.activeSessionId()) {
      try {
        await firstValueFrom(this.http.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.COMPLETE(this.activeSessionId()!)}`, {
          completedAt: new Date().toISOString(),
          notes: null
        }));
        
        this.activeSessionId.set(undefined);
      } catch (error) {
        console.error('Error completing session:', error);
      }
    }
    
    this.handleSessionCompletion();
    this.estimatedEndTime.set(undefined);
  }

  getCurrentModeDuration(): number {
    switch (this.mode()) {
      case 'work': return TIMER_DURATIONS.WORK;
      case 'shortBreak': return TIMER_DURATIONS.SHORT_BREAK;
      case 'longBreak': return TIMER_DURATIONS.LONG_BREAK;
      default: return TIMER_DURATIONS.WORK;
    }
  }


  private playNotificationSound(): void {
    try {
      const audio = new Audio();
      audio.src = 'assets/sounds/honk.mp3';
      audio.play().catch((error) => {
        console.log('🔔 Session completed! (Audio playback failed:', error.message, ')');
      });
    } catch (error) {
      console.log('🔔 Session completed! (Audio setup failed)');
    }
  }

  formatElapsedTime(): string {
    return formatElapsedTime(this.getCurrentModeDuration(), this.currentTime());
  }

  async changeMode(mode: TimerMode): Promise<void> {
    if (this.isRunning()) return; // Don't allow mode change while running
    
    try {
      await this.resetTimer(); // Reset any active session
    } catch (error) {
      console.error('Error resetting timer during mode change:', error);
      // Continue with local mode change even if server reset fails
      this.stopTimer();
      this.isRunning.set(false);
      this.activeSessionId.set(undefined);
      this.serverSync.set(false);
    }
    
    this.mode.set(mode);
    this.currentTime.set(this.getCurrentModeDuration());
    this.estimatedEndTime.set(undefined);
  }

  // Auto-increment Pomodoro count for selected task when work session completes
  private autoIncrementTaskPomodoros(): void {
    const selectedTask = this.selectedTask();
    if (selectedTask && !selectedTask.completed && this.mode() === 'work') {
      this.updateTaskPomodoros(selectedTask.id, true);
      
      // Get fresh task data after update to avoid stale data
      const updatedTask = this.tasks().find(task => task.id === selectedTask.id);
      if (updatedTask && updatedTask.completedPomodoros >= updatedTask.estimatedPomodoros) {
        this.autoCompleteTask(selectedTask.id);
      }
    }
  }

  // Common session completion logic to avoid duplication
  private handleSessionCompletion(): void {
    // Add session to tracking service
    const sessionDuration = this.getCurrentModeDuration() - this.currentTime();
    this.sessionTrackingService.addSession({
      date: new Date(),
      type: this.mode() === 'work' ? 'Work' : 'Break',
      duration: sessionDuration,
      taskId: this.selectedTaskId()
    });

    if (this.mode() === 'work') {
      // Work session completed - increment work session counters
      this.completedSessions.update(sessions => sessions + 1);
      this.totalSessions.update(sessions => sessions + 1);
      
      // Auto-increment Pomodoro count for selected task
      this.autoIncrementTaskPomodoros();
      
      // Check if we need a long break (every 4 work sessions)
      if (needsLongBreak(this.completedSessions(), TIMER_DURATIONS.SESSIONS_UNTIL_LONG_BREAK)) {
        // Time for a long break
        this.mode.set('longBreak');
        this.currentTime.set(TIMER_DURATIONS.LONG_BREAK);
      } else {
        // Take a short break
        this.mode.set('shortBreak');
        this.currentTime.set(TIMER_DURATIONS.SHORT_BREAK);
      }
    } else if (this.mode() === 'longBreak') {
      // Long break completed - increment completedToday and go to work
      this.completedToday.update(breaks => breaks + 1);
      this.mode.set('work');
      this.currentTime.set(TIMER_DURATIONS.WORK);
    } else {
      // Short break completed - go to work
      this.mode.set('work');
      this.currentTime.set(TIMER_DURATIONS.WORK);
    }
    
    // Play notification sound
    this.playNotificationSound();
  }

  // Auto-complete task with animation
  private autoCompleteTask(taskId: string): void {
    this.completingTaskId.set(taskId);
    
    // Delay the actual completion to allow for animation
    setTimeout(() => {
      // Only complete if task still exists and is not already completed
      const task = this.tasks().find(t => t.id === taskId);
      if (task && !task.completed) {
        this.toggleTaskComplete(taskId);
      }
      this.completingTaskId.set(undefined);
    }, 500);
  }
}
