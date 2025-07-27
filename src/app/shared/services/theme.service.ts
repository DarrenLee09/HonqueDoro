import { Injectable, signal, effect } from '@angular/core';
import { StorageService } from './storage.service';
import { AppSettings } from '../interfaces/settings.interface';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'honquedoro-theme';
  private readonly DARK_CLASS = 'dark-theme';
  
  // Signal for reactive theme state
  currentTheme = signal<Theme>('light');
  
  // Computed signal for easy dark mode checking
  isDarkMode = signal(false);

  constructor(private storageService: StorageService) {
    this.initializeTheme();
    this.setupThemeEffect();
  }

  private initializeTheme(): void {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    
    // Check for system preference if no saved theme
    const systemPrefersDark = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Use saved theme, or fall back to system preference, or default to light
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    this.setTheme(initialTheme);
  }

  private setupThemeEffect(): void {
    // Effect to apply theme changes to the DOM
    effect(() => {
      const theme = this.currentTheme();
      const isDark = theme === 'dark';
      
      // Update body class
      if (isDark) {
        document.body.classList.add(this.DARK_CLASS);
      } else {
        document.body.classList.remove(this.DARK_CLASS);
      }
      
      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#1a1a1a' : '#667eea');
      }
      
      // Update isDarkMode signal
      this.isDarkMode.set(isDark);
      
      // Save to localStorage
      localStorage.setItem(this.THEME_KEY, theme);
      
      // Update settings service
      const settings = this.storageService.getSettings<AppSettings>();
      if (settings) {
        settings.darkMode = isDark;
        this.storageService.saveSettings(settings);
      }
    });
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  setDarkMode(isDark: boolean): void {
    this.setTheme(isDark ? 'dark' : 'light');
  }

  // Get theme as readonly signal
  getTheme() {
    return this.currentTheme.asReadonly();
  }

  // Get dark mode status as readonly signal
  getDarkMode() {
    return this.isDarkMode.asReadonly();
  }

  // Listen for system theme changes
  listenForSystemThemeChanges(): void {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      mediaQuery.addEventListener('change', (e) => {
        // Only update if user hasn't manually set a preference
        if (!localStorage.getItem(this.THEME_KEY)) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  // Reset to system preference
  resetToSystemPreference(): void {
    localStorage.removeItem(this.THEME_KEY);
    const systemPrefersDark = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setTheme(systemPrefersDark ? 'dark' : 'light');
  }
}