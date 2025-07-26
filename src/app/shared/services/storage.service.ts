import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../constants/app-constants';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Get item from localStorage with error handling
   */
  getItem<T>(key: string): T | null {
    if (!this.isBrowser) return null;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error);
      // Clean up corrupted data
      this.removeItem(key);
      return null;
    }
  }

  /**
   * Set item in localStorage with error handling
   */
  setItem<T>(key: string, value: T): boolean {
    if (!this.isBrowser) return false;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): boolean {
    if (!this.isBrowser) return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
      return false;
    }
  }

  /**
   * Check if localStorage has a key
   */
  hasItem(key: string): boolean {
    if (!this.isBrowser) return false;
    return localStorage.getItem(key) !== null;
  }

  /**
   * Clear all localStorage data for the app
   */
  clearAll(): boolean {
    if (!this.isBrowser) return false;
    
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }

  /**
   * Get tasks from storage with validation
   */
  getTasks<T>(): T[] {
    const tasks = this.getItem<T[]>(STORAGE_KEYS.TASKS);
    if (!Array.isArray(tasks)) {
      console.warn('Invalid tasks data format, returning empty array');
      return [];
    }
    return tasks;
  }

  /**
   * Save tasks to storage
   */
  saveTasks<T>(tasks: T[]): boolean {
    return this.setItem(STORAGE_KEYS.TASKS, tasks);
  }

  /**
   * Get settings from storage
   */
  getSettings<T>(): T | null {
    return this.getItem<T>(STORAGE_KEYS.SETTINGS);
  }

  /**
   * Save settings to storage
   */
  saveSettings<T>(settings: T): boolean {
    return this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }
}