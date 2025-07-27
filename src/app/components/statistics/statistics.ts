import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../../shared/constants/app-constants';
import { SessionTrackingService, SessionRecord } from '../../shared/services/session-tracking.service';

@Component({
  selector: 'app-statistics',
  imports: [CommonModule, RouterLink],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css'
})
export class Statistics implements OnInit {
  private readonly apiBase = API_CONFIG.BASE_URL;
  
  // Expose Math for template use
  Math = Math;
  
  // Signals for reactive data
  overallStats = signal({
    totalSessions: 0,
    totalFocusTime: 0,
    averageSessionsPerDay: 0,
    currentStreak: 0,
    longestStreak: 0
  });

  weeklyData = signal([
    { day: 'Mon', sessions: 0, focusTime: 0 },
    { day: 'Tue', sessions: 0, focusTime: 0 },
    { day: 'Wed', sessions: 0, focusTime: 0 },
    { day: 'Thu', sessions: 0, focusTime: 0 },
    { day: 'Fri', sessions: 0, focusTime: 0 },
    { day: 'Sat', sessions: 0, focusTime: 0 },
    { day: 'Sun', sessions: 0, focusTime: 0 }
  ]);

  monthlyData = signal<{
    day: number;
    sessions: number;
    focusTime: number;
    date: Date;
    isEmpty?: boolean;
  }[]>([]);

  achievements: {
    title: string;
    description: string;
    earned: boolean;
    icon: string;
  }[] = [];

  // Computed properties
  totalFocusTimeFormatted = computed(() => {
    const totalTime = this.overallStats().totalFocusTime;
    const hours = Math.floor(totalTime / 60);
    const minutes = totalTime % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  });

  maxSessions = computed(() => {
    return Math.max(...this.weeklyData().map(d => d.sessions), 1);
  });

  earnedAchievements = computed(() => {
    return this.achievements.filter(a => a.earned).length;
  });

  // Hourly productivity data from dashboard
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

    const workSessions = sessions.filter(s => s.type === 'Work');
    
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

    return hourlyData.map(slot => ({
      ...slot,
      efficiency: slot.sessions > 0 
        ? Math.min(Math.round((slot.totalDuration / slot.sessions / 25) * 100), 100)
        : 0
    }));
  });

  bestProductivityHour = computed(() => {
    return this.hourlyProductivity().reduce((best, current) => 
      current.sessions > best.sessions ? current : best
    );
  });

  hasData = computed(() => {
    const sessions = this.sessionTrackingService.getSessions()();
    return sessions.filter(s => s.type === 'Work').length > 0;
  });

  constructor(
    private http: HttpClient,
    public sessionTrackingService: SessionTrackingService
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
    this.updateWeeklyData();
    this.updateMonthlyData();
    this.updateAchievements();
  }

  private async loadStatistics() {
    const allSessions = this.sessionTrackingService.getSessions()();
    const workSessions = allSessions.filter(s => s.type === 'Work');
    
    const totalSessions = workSessions.length;
    const totalFocusTime = workSessions.reduce((sum, s) => sum + s.duration, 0);
    const averageSessionsPerDay = this.calculateAverageSessionsPerDay(workSessions);
    const currentStreak = this.calculateCurrentStreak(workSessions);
    const longestStreak = this.calculateLongestStreak(workSessions);

    this.overallStats.set({
      totalSessions,
      totalFocusTime,
      averageSessionsPerDay,
      currentStreak,
      longestStreak
    });

    try {
      const apiStats = await firstValueFrom(this.http.get<any>(`${this.apiBase}/statistics`));
      this.overallStats.update(stats => ({
        ...stats,
        currentStreak: apiStats.currentStreak ?? stats.currentStreak,
        longestStreak: apiStats.bestStreak ?? stats.longestStreak
      }));
    } catch (error) {
      console.log('API not available, using calculated statistics');
    }
  }

  private updateWeeklyData() {
    const weeklySessions = this.sessionTrackingService.getWeeklySessions();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyData = [
      { day: 'Mon', sessions: 0, focusTime: 0 },
      { day: 'Tue', sessions: 0, focusTime: 0 },
      { day: 'Wed', sessions: 0, focusTime: 0 },
      { day: 'Thu', sessions: 0, focusTime: 0 },
      { day: 'Fri', sessions: 0, focusTime: 0 },
      { day: 'Sat', sessions: 0, focusTime: 0 },
      { day: 'Sun', sessions: 0, focusTime: 0 }
    ];

    weeklySessions.forEach(session => {
      if (session.type === 'Work') {
        const daysDiff = Math.floor((session.date.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
          weeklyData[daysDiff].sessions++;
          weeklyData[daysDiff].focusTime += session.duration;
        }
      }
    });

    this.weeklyData.set(weeklyData);
  }

  private updateMonthlyData() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    const allSessions = this.sessionTrackingService.getSessions()();
    
    // Add empty cells for days before the first day of the month
    const monthlyData: any[] = [];
    
    // Add empty cells for previous month days
    for (let i = 0; i < firstDayOfMonth; i++) {
      monthlyData.push({
        day: 0,
        sessions: 0,
        focusTime: 0,
        date: new Date(currentYear, currentMonth, -firstDayOfMonth + i + 1),
        isEmpty: true
      });
    }
    
    // Add actual month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      
      const daySessions = allSessions.filter(session => 
        this.isSameDay(session.date, date) && session.type === 'Work'
      );
      
      monthlyData.push({
        day: i,
        sessions: daySessions.length,
        focusTime: daySessions.reduce((sum, s) => sum + s.duration, 0),
        date,
        isEmpty: false
      });
    }
    
    this.monthlyData.set(monthlyData);
  }

  private updateAchievements() {
    const stats = this.overallStats();
    const sessions = this.sessionTrackingService.getSessions()();
    const workSessions = sessions.filter(s => s.type === 'Work');
    
    this.achievements = [
      { title: 'First Session', description: 'Complete your first Pomodoro session', earned: workSessions.length >= 1, icon: '🍅' },
      { title: 'Consistency Master', description: 'Complete sessions for 7 days in a row', earned: stats.currentStreak >= 7, icon: '🔥' },
      { title: 'Focus Champion', description: 'Complete 50 total sessions', earned: stats.totalSessions >= 50, icon: '🏆' },
      { title: 'Marathon Runner', description: 'Complete 100 total sessions', earned: stats.totalSessions >= 100, icon: '🏃' },
      { title: 'Zen Master', description: 'Complete 30 days streak', earned: stats.currentStreak >= 30, icon: '🧘' },
      { title: 'Productivity Guru', description: 'Complete 500 total sessions', earned: stats.totalSessions >= 500, icon: '⭐' },
      { title: 'Early Bird', description: 'Complete 10 sessions before 9 AM', earned: this.getEarlyBirdSessions() >= 10, icon: '🌅' },
      { title: 'Night Owl', description: 'Complete 10 sessions after 8 PM', earned: this.getNightOwlSessions() >= 10, icon: '🦉' },
      { title: 'Weekend Warrior', description: 'Complete sessions on weekends for 4 weeks', earned: this.getWeekendStreak() >= 4, icon: '⚔️' }
    ];
  }

  private calculateAverageSessionsPerDay(sessions: SessionRecord[]): number {
    if (sessions.length === 0) return 0;
    
    const firstSession = sessions.reduce((earliest, session) => 
      session.date < earliest.date ? session : earliest
    );
    
    const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - firstSession.date.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.round((sessions.length / daysSinceFirst) * 10) / 10;
  }

  private calculateCurrentStreak(sessions: SessionRecord[]): number {
    if (sessions.length === 0) return 0;
    
    const sortedSessions = sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 100; i++) {
      const dayHasSessions = sortedSessions.some(session => {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === currentDate.getTime();
      });
      
      if (dayHasSessions) {
        streak++;
      } else if (streak > 0) {
        break;
      }
      
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return streak;
  }

  private calculateLongestStreak(sessions: SessionRecord[]): number {
    if (sessions.length === 0) return 0;
    
    const uniqueDays = [...new Set(sessions.map(s => {
      const date = new Date(s.date);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }))].sort((a, b) => a - b);
    
    let longestStreak = 0;
    let currentStreak = 1;
    
    for (let i = 1; i < uniqueDays.length; i++) {
      const dayDiff = (uniqueDays[i] - uniqueDays[i - 1]) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    
    return Math.max(longestStreak, currentStreak);
  }

  private getEarlyBirdSessions(): number {
    const sessions = this.sessionTrackingService.getSessions()();
    return sessions.filter(s => s.type === 'Work' && s.date.getHours() < 9).length;
  }

  private getNightOwlSessions(): number {
    const sessions = this.sessionTrackingService.getSessions()();
    return sessions.filter(s => s.type === 'Work' && s.date.getHours() >= 20).length;
  }

  private getWeekendStreak(): number {
    const sessions = this.sessionTrackingService.getSessions()();
    const weekendSessions = sessions.filter(s => {
      const day = s.date.getDay();
      return s.type === 'Work' && (day === 0 || day === 6);
    });
    
    if (weekendSessions.length === 0) return 0;
    
    // Group by weeks and count consecutive weekend weeks
    const weeklyGroups = new Map<number, boolean>();
    
    weekendSessions.forEach(session => {
      const weekNumber = this.getWeekNumber(session.date);
      weeklyGroups.set(weekNumber, true);
    });
    
    const sortedWeeks = [...weeklyGroups.keys()].sort((a, b) => b - a);
    let streak = 0;
    
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (i === 0 || sortedWeeks[i] === sortedWeeks[i - 1] - 1) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  getBarHeight(sessions: number): number {
    return (sessions / this.maxSessions()) * 100;
  }

  getHourlyBarHeight(sessions: number): number {
    const maxSessions = Math.max(...this.hourlyProductivity().map(h => h.sessions), 1);
    return (sessions / maxSessions) * 100;
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

  getCurrentMonthName(): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[new Date().getMonth()];
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
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

  trackByDay(index: number, day: any): number {
    return day.day;
  }

  calculateEfficiency(sessions: number, focusTime: number): number {
    return sessions > 0 ? Math.round((focusTime / sessions / 25) * 100) : 0;
  }
}
