import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings {
  settings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    soundEnabled: true,
    desktopNotifications: true,
    darkMode: false,
    dailyGoal: 8
  };

  saveSettings(): void {
    // In a real app, this would save to a service or local storage
    console.log('Settings saved:', this.settings);
    // Show success message
    alert('Settings saved successfully!');
  }

  resetSettings(): void {
    this.settings = {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      soundEnabled: true,
      desktopNotifications: true,
      darkMode: false,
      dailyGoal: 8
    };
  }
}
