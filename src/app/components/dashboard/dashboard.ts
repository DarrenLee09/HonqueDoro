import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly apiBase = 'http://localhost:5116/api';

  // Signals for dashboard data
  todayStats = signal({
    completedSessions: 0,
    totalWorkTime: 0, // in minutes
    currentStreak: 0,
    bestStreak: 0
  });

  weeklyGoal = signal({
    target: 40, // You may want to make this configurable
    completed: 0
  });

  recentSessions = signal<{
    type: 'Work' | 'Break';
    duration: number;
    completedAt: Date;
  }[]>([]);

  // Computed for progress bar
  weeklyProgressPercentage = computed(() => {
    return Math.min((this.weeklyGoal().completed / this.weeklyGoal().target) * 100, 100);
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
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

  private fetchStatistics() {
    this.http.get<any>(`${this.apiBase}/statistics`).subscribe(stats => {
      this.todayStats.update(s => ({
        ...s,
        currentStreak: stats.currentStreak ?? 0,
        bestStreak: stats.bestStreak ?? 0
      }));
    });
  }

  private fetchTodaySessions() {
    this.http.get<any[]>(`${this.apiBase}/sessions/today`).subscribe(sessions => {
      // Only count work sessions for stats (type === 0)
      const workSessions = sessions.filter(s => s.type === 0);
      const totalWorkTime = workSessions.reduce((sum, s) => sum + (s.duration || s.durationMinutes || 0), 0);
      this.todayStats.update(s => ({
        ...s,
        completedSessions: workSessions.length,
        totalWorkTime
      }));
    });
  }

  private fetchRecentSessions() {
    this.http.get<any[]>(`${this.apiBase}/sessions/recent?count=40`).subscribe(sessions => {
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
    });
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
}
