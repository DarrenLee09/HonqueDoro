import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../shared/constants/app-constants';
import { formatTime } from '../../shared/utils/time.utils';
import { SessionTrackingService, SessionRecord } from '../../shared/services/session-tracking.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly apiBase = API_CONFIG.BASE_URL;
  
  // Expose Math for template use
  Math = Math;
  
  // UI state
  showGoalEditor = false;
  showMonthlyGoalEditor = signal(false);
  newMonthlyGoalTarget = signal<number>(160);
  selectedHourIndex = signal<number>(-1);

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

  // Monthly goal and data - now using real data
  monthlyGoal = signal({
    target: 160,
    completed: 0
  });

  monthlyData = signal<{
    day: number;
    sessions: number;
    focusTime: number;
    date: Date;
  }[]>([]);

  // Note: Historical sessions are now managed by SessionTrackingService

  // Productivity by time of day - computed from real data with demo fallback
  hourlyProductivity = computed(() => {
    const sessions = this.sessionTrackingService.getSessions()();
    const hourlyData = [
      { hour: '6-8 AM', label: 'Early Morning', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '8-10 AM', label: 'Morning', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '10-12 PM', label: 'Late Morning', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '12-2 PM', label: 'Afternoon', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '2-4 PM', label: 'Mid Afternoon', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '4-6 PM', label: 'Late Afternoon', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '6-8 PM', label: 'Evening', sessions: 0, efficiency: 0, totalDuration: 0 },
      { hour: '8-10 PM', label: 'Night', sessions: 0, efficiency: 0, totalDuration: 0 }
    ];

    // Only count work sessions for productivity analysis
    const workSessions = sessions.filter(s => s.type === 'Work');
    let hasRealData = workSessions.length > 0;
    
    workSessions.forEach(session => {
      const hour = session.date.getHours();
      let hourIndex = -1;
      
      if (hour >= 6 && hour < 8) hourIndex = 0;
      else if (hour >= 8 && hour < 10) hourIndex = 1;
      else if (hour >= 10 && hour < 12) hourIndex = 2;
      else if (hour >= 12 && hour < 14) hourIndex = 3;
      else if (hour >= 14 && hour < 16) hourIndex = 4;
      else if (hour >= 16 && hour < 18) hourIndex = 5;
      else if (hour >= 18 && hour < 20) hourIndex = 6;
      else if (hour >= 20 && hour < 22) hourIndex = 7;
      
      if (hourIndex >= 0) {
        hourlyData[hourIndex].sessions++;
        hourlyData[hourIndex].totalDuration += session.duration;
      }
    });

    // No demo data - show actual data only

    // Calculate efficiency based on average session duration vs expected (25min)
    return hourlyData.map(slot => ({
      ...slot,
      efficiency: slot.sessions > 0 
        ? Math.min(Math.round((slot.totalDuration / slot.sessions / 25) * 100), 100)
        : 0
    }));
  });

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
    const weeklySessions = this.sessionTrackingService.getWeeklySessions().filter(s => s.type === 'Work');
    
    // Group sessions by day of the week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const dailySessions = Array(7).fill(0);
    weeklySessions.forEach(session => {
      const daysDiff = Math.floor((session.date.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 7) {
        dailySessions[daysDiff]++;
      }
    });
    
    // Compare first half (Mon-Wed) vs second half (Thu-Sun)
    const firstHalf = dailySessions.slice(0, 3).reduce((sum, sessions) => sum + sessions, 0);
    const secondHalf = dailySessions.slice(3, 7).reduce((sum, sessions) => sum + sessions, 0);
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

  isTodayWeekly(dayIndex: number): boolean {
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

  // Additional productivity insights
  bestPerformingDay = computed(() => {
    const weeklySessions = this.sessionTrackingService.getWeeklySessions().filter(s => s.type === 'Work');
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dailyCounts = Array(7).fill(0);
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    
    weeklySessions.forEach(session => {
      const daysDiff = Math.floor((session.date.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 7) {
        dailyCounts[daysDiff]++;
      }
    });
    
    const maxSessions = Math.max(...dailyCounts);
    const bestDayIndex = dailyCounts.indexOf(maxSessions);
    
    return {
      day: dayNames[bestDayIndex],
      sessions: maxSessions,
      dayIndex: bestDayIndex
    };
  });

  currentStreak = computed(() => {
    const sessions = this.sessionTrackingService.getSessions()().filter(s => s.type === 'Work');
    if (sessions.length === 0) return 0;
    
    // Sort sessions by date (newest first)
    const sortedSessions = sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const dayHasSessions = sortedSessions.some(session => {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === currentDate.getTime();
      });
      
      if (dayHasSessions) {
        streak++;
      } else if (streak > 0) {
        break; // Streak is broken
      }
      
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  });

  weeklyAverage = computed(() => {
    const sessions = this.sessionTrackingService.getSessions()().filter(s => s.type === 'Work');
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const recentSessions = sessions.filter(s => s.date >= fourWeeksAgo);
    return Math.round(recentSessions.length / 4 * 10) / 10; // 4 weeks average
  });

  // Computed property for demo data notice
  showDemoNotice = computed(() => {
    const sessions = this.sessionTrackingService.getSessions()();
    return sessions.filter(s => s.type === 'Work').length === 0;
  });

  constructor(
    private http: HttpClient,
    public sessionTrackingService: SessionTrackingService
  ) {}

  ngOnInit(): void {
    // Load data from localStorage first
    this.loadFromLocalStorage();
    
    // Reset weekly data if it's a new week
    if (!this.isCurrentWeek()) {
      this.resetWeeklyData();
    }
    
    // Update monthly data after loading from localStorage
    this.updateMonthlyData();
    
    // Initialize monthly goal editor with current target
    this.newMonthlyGoalTarget.set(this.monthlyGoal().target);
    
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
        type: (s.type === 0) ? 'Work' as 'Work' : (s.type === 1 ? 'Short Break' as 'Break' : 'Long Break' as 'Break'),
        duration: s.duration || s.durationMinutes || 0,
        completedAt: s.completedAt ? new Date(s.completedAt) : new Date()
      }));
      this.recentSessions.set(mapped.slice(0, 15)); // Show 15 most recent for more activity
      // For weekly goal, count work sessions in the current week using session tracking service
      const weeklyWorkSessions = this.sessionTrackingService.getWeeklySessions().filter(s => s.type === 'Work').length;
      this.weeklyGoal.update(w => ({ ...w, completed: weeklyWorkSessions }));
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

  formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  formatFullDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  }

  // Methods to update weekly progress
  updateWeeklyGoal(newTarget: number): void {
    this.weeklyGoal.update(goal => ({ ...goal, target: newTarget }));
    this.saveToLocalStorage();
  }

  addSessionToDay(dayIndex: number, sessionType: 'Work' | 'Break' = 'Work'): void {
    const sessionDuration = sessionType === 'Work' ? 25 : 5;
    
    // Calculate the actual date for the day being modified
    const today = new Date();
    const currentDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert Sunday=0 to Saturday=6
    const daysDifference = dayIndex - currentDayIndex;
    const sessionDate = new Date(today);
    sessionDate.setDate(today.getDate() + daysDifference);
    
    // Add to session tracking service with the correct date
    this.sessionTrackingService.addSession({
      date: sessionDate,
      type: sessionType,
      duration: sessionDuration
    });
    
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

    // Add to recent sessions with correct timestamp
    this.recentSessions.update(sessions => [
      {
        type: sessionType,
        duration: sessionDuration,
        completedAt: sessionDate
      },
      ...sessions.slice(0, 9) // Keep only 10 most recent
    ]);

    // Update today's stats if it's today
    if (dayIndex === currentDayIndex && sessionType === 'Work') {
      this.todayStats.update(stats => ({
        ...stats,
        completedSessions: stats.completedSessions + 1,
        totalWorkTime: stats.totalWorkTime + sessionDuration
      }));
    }

    // Update monthly data
    this.updateMonthlyData();

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

  // Monthly data management methods
  updateMonthlyData(): void {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Get all sessions from the tracking service
    const allSessions = this.sessionTrackingService.getSessions()();
    
    // Generate data for each day of the current month
    const monthlyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(currentYear, currentMonth, day);
      
      // Filter sessions for this specific day
      const daySessions = allSessions.filter(session => 
        this.isSameDay(session.date, date)
      );
      
      const workSessions = daySessions.filter(s => s.type === 'Work');
      const totalSessions = workSessions.length;
      const totalFocusTime = workSessions.reduce((sum, s) => sum + s.duration, 0);
      
      return {
        day,
        sessions: totalSessions,
        focusTime: totalFocusTime,
        date
      };
    });
    
    this.monthlyData.set(monthlyData);
    
    // Update monthly goal completed count using session tracking service
    const monthlyWorkSessions = this.sessionTrackingService.getMonthlySessions().filter(s => s.type === 'Work');
    
    this.monthlyGoal.update(goal => ({
      ...goal,
      completed: monthlyWorkSessions.length
    }));
  }

  updateMonthlyGoal(newTarget: number): void {
    this.monthlyGoal.update(goal => ({ ...goal, target: newTarget }));
    this.saveToLocalStorage();
  }

  // Helper method to check if two dates are the same day
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Get current month name
  getCurrentMonthName(): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[new Date().getMonth()];
  }

  // Get current year
  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  // Monthly goal editing methods
  saveMonthlyGoal(): void {
    if (this.newMonthlyGoalTarget() && this.newMonthlyGoalTarget() > 0) {
      this.updateMonthlyGoal(this.newMonthlyGoalTarget());
      this.showMonthlyGoalEditor.set(false);
    }
  }

  cancelMonthlyGoalEdit(): void {
    this.newMonthlyGoalTarget.set(this.monthlyGoal().target);
    this.showMonthlyGoalEditor.set(false);
  }

  // Calendar helper methods
  trackByDay(index: number, day: any): number {
    return day.day;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  getSessionDots(sessionCount: number): number[] {
    const maxDots = 5;
    const dotCount = Math.min(sessionCount, maxDots);
    return Array.from({ length: dotCount }, (_, i) => i);
  }

  // Interactive features for productivity insights
  selectHour(hourIndex: number): void {
    this.selectedHourIndex.set(hourIndex);
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

        if (data.monthlyGoal) {
          this.monthlyGoal.set(data.monthlyGoal);
        }

        // Note: Historical sessions are now managed by SessionTrackingService
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
        monthlyGoal: this.monthlyGoal(),
        monthlyData: this.monthlyData(),
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
