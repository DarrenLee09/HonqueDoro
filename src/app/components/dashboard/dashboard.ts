import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../shared/constants/app-constants';
import { formatTime } from '../../shared/utils/time.utils';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly apiBase = API_CONFIG.BASE_URL;
  
  // Expose Math for template use
  Math = Math;
  
  // UI state
  showGoalEditor = false;

  // Signals for dashboard data
  todayStats = signal({
    completedSessions: 3,
    totalWorkTime: 75, // in minutes
    currentStreak: 5,
    bestStreak: 12
  });

  weeklyGoal = signal({
    target: 40,
    completed: 18
  });

  weeklyData = signal([
    { day: 'Mon', sessions: 6, focusTime: 150, completed: true },
    { day: 'Tue', sessions: 4, focusTime: 100, completed: true },
    { day: 'Wed', sessions: 8, focusTime: 200, completed: true },
    { day: 'Thu', sessions: 0, focusTime: 0, completed: false },
    { day: 'Fri', sessions: 0, focusTime: 0, completed: false },
    { day: 'Sat', sessions: 0, focusTime: 0, completed: false },
    { day: 'Sun', sessions: 0, focusTime: 0, completed: false }
  ]);

  recentSessions = signal<{
    type: 'Work' | 'Break';
    duration: number;
    completedAt: Date;
  }[]>([
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 30) },
    { type: 'Break', duration: 5, completedAt: new Date(Date.now() - 1000 * 60 * 60) },
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 90) },
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 120) }
  ]);

  // Monthly goal and data
  monthlyGoal = signal({
    target: 160,
    completed: 78
  });

  monthlyData = signal(Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    sessions: Math.floor(Math.random() * 8),
    focusTime: Math.floor(Math.random() * 200)
  })));

  // Productivity by time of day
  hourlyProductivity = signal([
    { hour: '6-8', sessions: 2, efficiency: 85 },
    { hour: '8-10', sessions: 8, efficiency: 92 },
    { hour: '10-12', sessions: 12, efficiency: 88 },
    { hour: '12-14', sessions: 6, efficiency: 75 },
    { hour: '14-16', sessions: 10, efficiency: 90 },
    { hour: '16-18', sessions: 8, efficiency: 82 },
    { hour: '18-20', sessions: 4, efficiency: 70 },
    { hour: '20-22', sessions: 2, efficiency: 65 }
  ]);

  // Additional computed properties
  maxWeeklySessions = computed(() => {
    return Math.max(...this.weeklyData().map(d => d.sessions), 1);
  });

  monthlyStats = computed(() => {
    const data = this.monthlyData();
    const totalSessions = data.reduce((sum, day) => sum + day.sessions, 0);
    const totalFocusTime = data.reduce((sum, day) => sum + day.focusTime, 0);
    const activeDays = data.filter(day => day.sessions > 0).length;
    const averageDaily = Math.round(totalSessions / 30 * 10) / 10;
    
    return {
      totalSessions,
      totalFocusTime,
      activeDays,
      averageDaily,
      completionRate: Math.round((this.monthlyGoal().completed / this.monthlyGoal().target) * 100)
    };
  });

  bestProductivityHour = computed(() => {
    return this.hourlyProductivity().reduce((best, current) => 
      current.sessions > best.sessions ? current : best
    );
  });

  productivityTrend = computed(() => {
    const weekly = this.weeklyData();
    const firstHalf = weekly.slice(0, 3).reduce((sum, day) => sum + day.sessions, 0);
    const secondHalf = weekly.slice(4, 7).reduce((sum, day) => sum + day.sessions, 0);
    const trend = secondHalf - firstHalf;
    
    return {
      direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
      change: Math.abs(trend),
      percentage: firstHalf > 0 ? Math.round((trend / firstHalf) * 100) : 0
    };
  });

  todayProgress = computed(() => {
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1; // Convert Sunday=0 to Saturday=6
    return this.weeklyData()[todayIndex];
  });

  weeklyStats = computed(() => {
    const data = this.weeklyData();
    return {
      totalSessions: data.reduce((sum, day) => sum + day.sessions, 0),
      totalFocusTime: data.reduce((sum, day) => sum + day.focusTime, 0),
      activeDays: data.filter(day => day.sessions > 0).length,
      averageDaily: Math.round(data.reduce((sum, day) => sum + day.sessions, 0) / 7 * 10) / 10
    };
  });

  // Computed for progress bar
  weeklyProgressPercentage = computed(() => {
    return Math.min((this.weeklyGoal().completed / this.weeklyGoal().target) * 100, 100);
  });

  // Helper methods for weekly chart - fixed to show consistent heights
  getBarHeight(sessions: number): number {
    // Each session = 10% height, max 100%
    return Math.min(sessions * 10, 100);
  }

  isToday(dayIndex: number): boolean {
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1;
    return dayIndex === todayIndex;
  }

  formatFocusTime(minutes: number): string {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  getHourlyBarHeight(sessions: number): number {
    const maxSessions = Math.max(...this.hourlyProductivity().map(h => h.sessions), 1);
    return (sessions / maxSessions) * 100;
  }

  getTrendIcon(): string {
    const trend = this.productivityTrend();
    return trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️';
  }

  getTrendColor(): string {
    const trend = this.productivityTrend();
    return trend.direction === 'up' ? '#4CAF50' : trend.direction === 'down' ? '#f44336' : '#ff9800';
  }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Load data from localStorage first
    this.loadFromLocalStorage();
    
    // Reset weekly data if it's a new week
    if (!this.isCurrentWeek()) {
      this.resetWeeklyData();
    }
    
    // Fetch fresh data from API (if available)
    this.fetchStatistics();
    this.fetchTodaySessions();
    this.fetchRecentSessions();
  }

  // Helper: Check if a date is in the current week (Monday-Sunday)
  private isDateInCurrentWeek(date: Date): boolean {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return date >= startOfWeek && date <= endOfWeek;
  }

  private async fetchStatistics() {
    try {
      const stats = await firstValueFrom(this.http.get<any>(`${this.apiBase}/statistics`));
      this.todayStats.update(s => ({
        ...s,
        currentStreak: stats.currentStreak ?? s.currentStreak,
        bestStreak: stats.bestStreak ?? s.bestStreak
      }));
    } catch (error) {
      console.log('API not available, using demo data for statistics');
      // Keep demo values - already set in signal initialization
    }
  }

  private async fetchTodaySessions() {
    try {
      const sessions = await firstValueFrom(this.http.get<any[]>(`${this.apiBase}/sessions/today`));
      // Only count work sessions for stats (type === 0)
      const workSessions = sessions.filter(s => s.type === 0);
      const totalWorkTime = workSessions.reduce((sum, s) => sum + (s.duration || s.durationMinutes || 0), 0);
      this.todayStats.update(s => ({
        ...s,
        completedSessions: workSessions.length,
        totalWorkTime
      }));
    } catch (error) {
      console.log('API not available, using demo data for today sessions');
      // Keep demo values - already set in signal initialization
    }
  }

  private async fetchRecentSessions() {
    try {
      const sessions = await firstValueFrom(this.http.get<any[]>(`${this.apiBase}/sessions/recent?count=40`));
      // Map backend types to 'Work'/'Break' for display, cast as 'Work' | 'Break'
      const mapped = sessions.map(s => ({
        type: (s.type === 0) ? 'Work' as 'Work' : 'Break' as 'Break',
        duration: s.duration || s.durationMinutes || 0,
        completedAt: s.completedAt ? new Date(s.completedAt) : new Date()
      }));
      this.recentSessions.set(mapped.slice(0, 10)); // Still show 10 most recent for activity
      // For weekly goal, count work sessions in the current week
      const completed = mapped.filter(s => s.type === 'Work' && this.isDateInCurrentWeek(s.completedAt)).length;
      this.weeklyGoal.update(w => ({ ...w, completed }));
    } catch (error) {
      console.log('API not available, using demo data for recent sessions');
      // Keep demo values - already set in signal initialization
    }
  }

  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  }

  // Methods to update weekly progress
  updateWeeklyGoal(newTarget: number): void {
    this.weeklyGoal.update(goal => ({ ...goal, target: newTarget }));
    this.saveToLocalStorage();
  }

  addSessionToDay(dayIndex: number, sessionType: 'Work' | 'Break' = 'Work'): void {
    const sessionDuration = sessionType === 'Work' ? 25 : 5;
    
    this.weeklyData.update(data => {
      const newData = [...data];
      newData[dayIndex] = {
        ...newData[dayIndex],
        sessions: newData[dayIndex].sessions + 1,
        focusTime: newData[dayIndex].focusTime + sessionDuration,
        completed: true
      };
      return newData;
    });

    // Update weekly goal completed count
    if (sessionType === 'Work') {
      this.weeklyGoal.update(goal => ({ 
        ...goal, 
        completed: goal.completed + 1 
      }));
    }

    // Add to recent sessions
    this.recentSessions.update(sessions => [
      {
        type: sessionType,
        duration: sessionDuration,
        completedAt: new Date()
      },
      ...sessions.slice(0, 9) // Keep only 10 most recent
    ]);

    // Update today's stats if it's today
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1;
    if (dayIndex === todayIndex && sessionType === 'Work') {
      this.todayStats.update(stats => ({
        ...stats,
        completedSessions: stats.completedSessions + 1,
        totalWorkTime: stats.totalWorkTime + sessionDuration
      }));
    }

    this.saveToLocalStorage();
  }

  removeSessionFromDay(dayIndex: number): void {
    this.weeklyData.update(data => {
      const newData = [...data];
      if (newData[dayIndex].sessions > 0) {
        const sessionDuration = 25; // Assuming work session
        newData[dayIndex] = {
          ...newData[dayIndex],
          sessions: Math.max(0, newData[dayIndex].sessions - 1),
          focusTime: Math.max(0, newData[dayIndex].focusTime - sessionDuration),
          completed: newData[dayIndex].sessions - 1 > 0
        };

        // Update weekly goal
        this.weeklyGoal.update(goal => ({ 
          ...goal, 
          completed: Math.max(0, goal.completed - 1) 
        }));

        // Update today's stats if it's today
        const today = new Date().getDay();
        const todayIndex = today === 0 ? 6 : today - 1;
        if (dayIndex === todayIndex) {
          this.todayStats.update(stats => ({
            ...stats,
            completedSessions: Math.max(0, stats.completedSessions - 1),
            totalWorkTime: Math.max(0, stats.totalWorkTime - sessionDuration)
          }));
        }
      }
      return newData;
    });

    this.saveToLocalStorage();
  }

  resetWeeklyData(): void {
    this.weeklyData.set([
      { day: 'Mon', sessions: 0, focusTime: 0, completed: false },
      { day: 'Tue', sessions: 0, focusTime: 0, completed: false },
      { day: 'Wed', sessions: 0, focusTime: 0, completed: false },
      { day: 'Thu', sessions: 0, focusTime: 0, completed: false },
      { day: 'Fri', sessions: 0, focusTime: 0, completed: false },
      { day: 'Sat', sessions: 0, focusTime: 0, completed: false },
      { day: 'Sun', sessions: 0, focusTime: 0, completed: false }
    ]);
    
    this.weeklyGoal.update(goal => ({ ...goal, completed: 0 }));
    this.todayStats.update(stats => ({ ...stats, completedSessions: 0, totalWorkTime: 0 }));
    this.recentSessions.set([]);
    
    this.saveToLocalStorage();
  }

  // Load data from localStorage on init
  private loadFromLocalStorage(): void {
    try {
      const savedData = localStorage.getItem('honquedoro-dashboard-data');
      if (savedData) {
        const data = JSON.parse(savedData);
        
        if (data.weeklyGoal) {
          this.weeklyGoal.set(data.weeklyGoal);
        }
        
        if (data.weeklyData) {
          this.weeklyData.set(data.weeklyData);
        }
        
        if (data.todayStats) {
          this.todayStats.set(data.todayStats);
        }
        
        if (data.recentSessions) {
          // Parse dates back from JSON
          const sessions = data.recentSessions.map((s: any) => ({
            ...s,
            completedAt: new Date(s.completedAt)
          }));
          this.recentSessions.set(sessions);
        }
      }
    } catch (error) {
      console.warn('Failed to load dashboard data from localStorage:', error);
    }
  }

  // Save data to localStorage
  private saveToLocalStorage(): void {
    try {
      const dataToSave = {
        weeklyGoal: this.weeklyGoal(),
        weeklyData: this.weeklyData(),
        todayStats: this.todayStats(),
        recentSessions: this.recentSessions(),
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem('honquedoro-dashboard-data', JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('Failed to save dashboard data to localStorage:', error);
    }
  }

  // Check if data is from current week
  private isCurrentWeek(): boolean {
    try {
      const savedData = localStorage.getItem('honquedoro-dashboard-data');
      if (!savedData) return false;
      
      const data = JSON.parse(savedData);
      if (!data.lastUpdated) return false;
      
      const lastUpdated = new Date(data.lastUpdated);
      const now = new Date();
      
      // Get start of current week (Monday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      
      return lastUpdated >= startOfWeek;
    } catch {
      return false;
    }
  }
}
