import { Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AppSettings } from '../interfaces/settings.interface';

export interface NotificationSettings {
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private notificationPermission = signal<NotificationPermission>('default');
  
  constructor(private storageService: StorageService) {
    this.initializeAudio();
    this.checkNotificationPermission();
  }

  private initializeAudio(): void {
    try {
      this.audio = new Audio('/sounds/honk.mp3');
      this.audio.preload = 'auto';
      
      // Test if audio can be loaded
      this.audio.addEventListener('error', (e) => {
        console.warn('Audio file failed to load, will use fallback beep:', e);
        this.audio = null;
      });
    } catch (error) {
      console.warn('Failed to load audio file:', error);
      this.audio = null;
    }
  }

  private checkNotificationPermission(): void {
    if ('Notification' in window) {
      this.notificationPermission.set(Notification.permission);
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission is denied. User needs to enable it manually in browser settings.');
      return false;
    }

    try {
      console.log('Requesting notification permission from user...');
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      this.notificationPermission.set(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  getNotificationPermission() {
    return this.notificationPermission.asReadonly();
  }

  private getSettings(): NotificationSettings {
    const settings = this.storageService.getSettings<AppSettings>();
    return {
      soundEnabled: settings?.soundEnabled ?? true,
      desktopNotifications: settings?.desktopNotifications ?? true
    };
  }

  async playSound(): Promise<void> {
    const settings = this.getSettings();
    
    console.log('Playing sound with settings:', { soundEnabled: settings.soundEnabled });
    
    if (!settings.soundEnabled) {
      console.log('Sound disabled, skipping playback');
      return;
    }

    try {
      if (this.audio) {
        this.audio.volume = 0.5; // Fixed moderate volume
        this.audio.currentTime = 0;
        console.log('Playing audio file');
        await this.audio.play();
      } else {
        // Fallback to Web Audio API beep
        console.log('Using fallback beep sound');
        await this.playBeepSound();
      }
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
      // Try fallback beep on error
      try {
        console.log('Trying fallback beep after audio error');
        await this.playBeepSound();
      } catch (beepError) {
        console.warn('Fallback beep also failed:', beepError);
      }
    }
  }

  private async playBeepSound(): Promise<void> {
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      console.warn('Web Audio API not supported');
      return;
    }

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Create oscillator and gain nodes
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Configure sound
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz frequency
    oscillator.type = 'sine';
    
    // Set moderate fixed volume
    const targetVolume = 0.1; // Fixed moderate volume
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    // Play sound
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
    
    // Clean up
    return new Promise((resolve) => {
      oscillator.onended = () => {
        audioCtx.close();
        resolve();
      };
    });
  }

  async showDesktopNotification(title: string, options?: NotificationOptions): Promise<void> {
    const settings = this.getSettings();
    
    console.log('Desktop notification request:', { 
      title, 
      desktopNotifications: settings.desktopNotifications,
      notificationSupported: 'Notification' in window,
      permission: Notification.permission 
    });
    
    if (!settings.desktopNotifications) {
      console.log('Desktop notifications disabled in settings');
      return;
    }
    
    if (!('Notification' in window)) {
      console.warn('Desktop notifications not supported in this browser');
      throw new Error('Desktop notifications not supported');
    }

    if (Notification.permission !== 'granted') {
      console.log('Requesting notification permission...');
      const granted = await this.requestNotificationPermission();
      if (!granted) {
        console.warn('Notification permission denied');
        throw new Error('Notification permission denied');
      }
    }

    try {
      console.log('Creating desktop notification:', title);
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'honquedoro-timer',
        requireInteraction: false,
        ...options
      });

      console.log('Desktop notification created successfully');

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click to focus the app
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Failed to show desktop notification:', error);
      throw error;
    }
  }

  async notifySessionStart(sessionType: 'work' | 'shortBreak' | 'longBreak'): Promise<void> {
    const messages = {
      work: {
        title: '🍅 Work Session Started',
        body: 'Time to focus! Let\'s get productive.',
        icon: '🍅'
      },
      shortBreak: {
        title: '☕ Short Break Started',
        body: 'Take a quick break. You deserve it!',
        icon: '☕'
      },
      longBreak: {
        title: '🌟 Long Break Started',
        body: 'Time for a longer break. Relax and recharge!',
        icon: '🌟'
      }
    };

    const message = messages[sessionType];
    
    await Promise.all([
      this.playSound(),
      this.showDesktopNotification(message.title, {
        body: message.body,
        tag: 'session-start'
      })
    ]);
  }

  async notifySessionComplete(sessionType: 'work' | 'shortBreak' | 'longBreak'): Promise<void> {
    const messages = {
      work: {
        title: '✅ Work Session Complete!',
        body: 'Great job! Time for a well-deserved break.',
        icon: '✅'
      },
      shortBreak: {
        title: '🔄 Break Complete',
        body: 'Break time is over. Ready for the next session?',
        icon: '🔄'
      },
      longBreak: {
        title: '🚀 Long Break Complete',
        body: 'Feeling refreshed? Let\'s get back to work!',
        icon: '🚀'
      }
    };

    const message = messages[sessionType];
    
    await Promise.all([
      this.playSound(),
      this.showDesktopNotification(message.title, {
        body: message.body,
        tag: 'session-complete',
        requireInteraction: true
      })
    ]);
  }

  async notifySessionSkipped(sessionType: 'work' | 'shortBreak' | 'longBreak'): Promise<void> {
    const message = {
      title: '⏭️ Session Skipped',
      body: `${sessionType === 'work' ? 'Work session' : 'Break'} was skipped.`
    };
    
    await this.showDesktopNotification(message.title, {
      body: message.body,
      tag: 'session-skipped'
    });
  }

  async testNotifications(): Promise<void> {
    await Promise.all([
      this.playSound(),
      this.showDesktopNotification('🔔 Test Notification', {
        body: 'Notifications are working correctly!',
        tag: 'test'
      })
    ]);
  }

  // Utility method to check if notifications are fully enabled
  areNotificationsEnabled(): boolean {
    const settings = this.getSettings();
    return (settings.soundEnabled || settings.desktopNotifications) && 
           (Notification.permission === 'granted' || !settings.desktopNotifications);
  }
}