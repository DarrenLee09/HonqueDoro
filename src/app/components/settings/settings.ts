import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../shared/services/storage.service';
import { TIMER_DEFAULTS } from '../../shared/constants/app-constants';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  settings = {
    workDuration: TIMER_DEFAULTS.WORK_DURATION_MINUTES,
    shortBreakDuration: TIMER_DEFAULTS.SHORT_BREAK_DURATION_MINUTES,
    longBreakDuration: TIMER_DEFAULTS.LONG_BREAK_DURATION_MINUTES,
    sessionsUntilLongBreak: TIMER_DEFAULTS.SESSIONS_UNTIL_LONG_BREAK,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    soundEnabled: true,
    desktopNotifications: true,
    darkMode: false,
    dailyGoal: 8
  };

  isLoading = signal(false);
  successMessage = signal<string | null>(null);

  constructor(private storageService: StorageService) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    const savedSettings = this.storageService.getSettings();
    if (savedSettings) {
      this.settings = { ...this.settings, ...savedSettings };
    }
  }

  saveSettings(): void {
    this.isLoading.set(true);
    this.successMessage.set(null);
    
    try {
      const success = this.storageService.saveSettings(this.settings);
      if (success) {
        this.successMessage.set('Settings saved successfully!');
        console.log('Settings saved:', this.settings);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage.set(null);
        }, 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  resetSettings(): void {
    this.settings = {
      workDuration: TIMER_DEFAULTS.WORK_DURATION_MINUTES,
      shortBreakDuration: TIMER_DEFAULTS.SHORT_BREAK_DURATION_MINUTES,
      longBreakDuration: TIMER_DEFAULTS.LONG_BREAK_DURATION_MINUTES,
      sessionsUntilLongBreak: TIMER_DEFAULTS.SESSIONS_UNTIL_LONG_BREAK,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      soundEnabled: true,
      desktopNotifications: true,
      darkMode: false,
      dailyGoal: 8
    };
  }
}
