import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  // Mock data - in a real app, this would come from a service
  todayStats = {
    completedSessions: 8,
    totalWorkTime: 200, // in minutes
    currentStreak: 3,
    bestStreak: 12
  };

  weeklyGoal = {
    target: 40,
    completed: 28
  };

  recentSessions = [
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 30) },
    { type: 'Break', duration: 5, completedAt: new Date(Date.now() - 1000 * 60 * 60) },
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 90) },
    { type: 'Work', duration: 25, completedAt: new Date(Date.now() - 1000 * 60 * 120) },
  ];

  get weeklyProgressPercentage(): number {
    return Math.min((this.weeklyGoal.completed / this.weeklyGoal.target) * 100, 100);
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
