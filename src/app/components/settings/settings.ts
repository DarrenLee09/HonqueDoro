import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../shared/services/storage.service';
import { SessionTrackingService } from '../../shared/services/session-tracking.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ThemeService } from '../../shared/services/theme.service';
import { TIMER_DEFAULTS } from '../../shared/constants/app-constants';
import { AppSettings } from '../../shared/interfaces/settings.interface';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {
  settings: AppSettings = {
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
  selectedFile: File | null = null;

  constructor(
    private storageService: StorageService,
    private sessionTrackingService: SessionTrackingService,
    public notificationService: NotificationService,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    const savedSettings = this.storageService.getSettings<AppSettings>();
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

  // Data Management Methods
  exportData(): void {
    try {
      const sessions = this.sessionTrackingService.getSessions()();
      const exportData = {
        sessions,
        settings: this.settings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `honquedoro-data-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.successMessage.set('Data exported successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  }

  exportCSV(): void {
    try {
      const sessions = this.sessionTrackingService.getSessions()();
      const headers = ['Date', 'Type', 'Duration (minutes)', 'Task ID'];
      const csvData = [headers];

      sessions.forEach(session => {
        csvData.push([
          session.date.toISOString(),
          session.type,
          session.duration.toString(),
          session.taskId || ''
        ]);
      });

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `honquedoro-sessions-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.successMessage.set('CSV exported successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Failed to export CSV. Please try again.');
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      this.selectedFile = file;
    } else {
      alert('Please select a valid JSON file.');
      this.clearFileSelection();
    }
  }

  clearFileSelection(): void {
    this.selectedFile = null;
    const fileInput = document.getElementById('importFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  importData(): void {
    if (!this.selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.sessions && Array.isArray(importData.sessions)) {
          // Clear existing sessions
          this.sessionTrackingService.clearAllSessions();
          
          // Import sessions
          importData.sessions.forEach((session: any) => {
            this.sessionTrackingService.addSession({
              date: new Date(session.date),
              type: session.type,
              duration: session.duration,
              taskId: session.taskId
            });
          });

          // Import settings if available
          if (importData.settings) {
            this.settings = { ...this.settings, ...importData.settings };
            this.storageService.saveSettings(this.settings);
          }

          this.successMessage.set('Data imported successfully!');
          this.clearFileSelection();
          setTimeout(() => this.successMessage.set(null), 3000);
        } else {
          throw new Error('Invalid data format');
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(this.selectedFile);
  }

  clearSessionHistory(): void {
    if (confirm('Are you sure you want to clear all session history? This action cannot be undone.')) {
      this.sessionTrackingService.clearAllSessions();
      this.successMessage.set('Session history cleared successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    }
  }

  resetAllData(): void {
    if (confirm('Are you sure you want to reset ALL data including settings and session history? This action cannot be undone.')) {
      // Clear session history
      this.sessionTrackingService.clearAllSessions();
      
      // Reset settings
      this.resetSettings();
      this.storageService.saveSettings(this.settings);
      
      // Clear other localStorage data
      localStorage.removeItem('honquedoro-settings');
      
      this.successMessage.set('All data reset successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    }
  }

  // Notification Methods
  async onDesktopNotificationToggle(): Promise<void> {
    if (this.settings.desktopNotifications) {
      await this.notificationService.requestNotificationPermission();
    }
  }

  async requestNotificationPermission(): Promise<void> {
    const granted = await this.notificationService.requestNotificationPermission();
    if (granted) {
      this.successMessage.set('Notifications enabled successfully!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } else {
      this.settings.desktopNotifications = false;
      alert('Notification permission was denied. You can enable it later in your browser settings.');
    }
  }

  needsPermission(): boolean {
    return this.settings.desktopNotifications && 
           this.notificationService.getNotificationPermission()() !== 'granted';
  }

  getPermissionStatusClass(): string {
    const permission = this.notificationService.getNotificationPermission()();
    switch (permission) {
      case 'granted':
        return 'status-granted';
      case 'denied':
        return 'status-denied';
      default:
        return 'status-default';
    }
  }

  getPermissionStatusText(): string {
    const permission = this.notificationService.getNotificationPermission()();
    switch (permission) {
      case 'granted':
        return 'Notifications enabled';
      case 'denied':
        return 'Notifications blocked';
      default:
        return 'Permission required';
    }
  }

  async testSound(): Promise<void> {
    try {
      await this.notificationService.playSound();
      this.successMessage.set('Sound test completed!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      console.error('Sound test failed:', error);
      alert('Sound test failed. Please check your sound settings.');
    }
  }

  async testDesktopNotification(): Promise<void> {
    try {
      await this.notificationService.showDesktopNotification('🔔 Test Notification', {
        body: 'Desktop notifications are working correctly!',
        tag: 'test'
      });
      this.successMessage.set('Desktop notification test sent!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      console.error('Desktop notification test failed:', error);
      alert('Desktop notification test failed. Please check your notification permissions.');
    }
  }

  async testAllNotifications(): Promise<void> {
    try {
      await this.notificationService.testNotifications();
      this.successMessage.set('All notification tests completed!');
      setTimeout(() => this.successMessage.set(null), 3000);
    } catch (error) {
      console.error('Notification tests failed:', error);
      alert('Some notification tests failed. Please check your settings.');
    }
  }

  // Theme Methods
  onDarkModeToggle(): void {
    this.themeService.setDarkMode(this.settings.darkMode);
    this.successMessage.set(`${this.settings.darkMode ? 'Dark' : 'Light'} mode enabled!`);
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  resetToSystemTheme(): void {
    this.themeService.resetToSystemPreference();
    const isDark = this.themeService.getDarkMode()();
    this.settings.darkMode = isDark;
    this.successMessage.set('Theme reset to system preference!');
    setTimeout(() => this.successMessage.set(null), 3000);
  }
}
