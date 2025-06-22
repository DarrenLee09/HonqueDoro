import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-statistics',
  imports: [CommonModule],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css'
})
export class Statistics {
  // Mock data - in a real app, this would come from a service
  overallStats = {
    totalSessions: 156,
    totalFocusTime: 3900, // in minutes
    averageSessionsPerDay: 6.2,
    currentStreak: 12,
    longestStreak: 28
  };

  weeklyData = [
    { day: 'Mon', sessions: 8, focusTime: 200 },
    { day: 'Tue', sessions: 6, focusTime: 150 },
    { day: 'Wed', sessions: 9, focusTime: 225 },
    { day: 'Thu', sessions: 7, focusTime: 175 },
    { day: 'Fri', sessions: 5, focusTime: 125 },
    { day: 'Sat', sessions: 4, focusTime: 100 },
    { day: 'Sun', sessions: 3, focusTime: 75 }
  ];

  achievements = [
    { title: 'First Session', description: 'Complete your first Pomodoro session', earned: true, icon: '🍅' },
    { title: 'Consistency Master', description: 'Complete sessions for 7 days in a row', earned: true, icon: '🔥' },
    { title: 'Focus Champion', description: 'Complete 50 total sessions', earned: true, icon: '🏆' },
    { title: 'Marathon Runner', description: 'Complete 100 total sessions', earned: true, icon: '🏃' },
    { title: 'Zen Master', description: 'Complete 30 days streak', earned: false, icon: '🧘' },
    { title: 'Productivity Guru', description: 'Complete 500 total sessions', earned: false, icon: '⭐' }
  ];

  get totalFocusTimeFormatted(): string {
    const hours = Math.floor(this.overallStats.totalFocusTime / 60);
    const minutes = this.overallStats.totalFocusTime % 60;
    return `${hours}h ${minutes}m`;
  }

  get maxSessions(): number {
    return Math.max(...this.weeklyData.map(d => d.sessions));
  }

  getBarHeight(sessions: number): number {
    return (sessions / this.maxSessions) * 100;
  }

  get earnedAchievements(): number {
    return this.achievements.filter(a => a.earned).length;
  }
}
