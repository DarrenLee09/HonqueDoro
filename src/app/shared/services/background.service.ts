import { Injectable, signal } from '@angular/core';

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundService {
  private currentColor = signal<string>('#667eea');

  readonly colorPalette: ColorOption[] = [
    { id: 'purple', name: 'Purple', hex: '#667eea' },
    { id: 'blue', name: 'Blue', hex: '#3b82f6' },
    { id: 'cyan', name: 'Cyan', hex: '#06b6d4' },
    { id: 'teal', name: 'Teal', hex: '#14b8a6' },
    { id: 'green', name: 'Green', hex: '#22c55e' },
    { id: 'lime', name: 'Lime', hex: '#84cc16' },
    { id: 'yellow', name: 'Yellow', hex: '#eab308' },
    { id: 'orange', name: 'Orange', hex: '#f97316' },
    { id: 'red', name: 'Red', hex: '#ef4444' },
    { id: 'pink', name: 'Pink', hex: '#ec4899' },
    { id: 'rose', name: 'Rose', hex: '#f43f5e' },
    { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
    { id: 'violet', name: 'Violet', hex: '#8b5cf6' },
    { id: 'purple-dark', name: 'Dark Purple', hex: '#7c3aed' },
    { id: 'slate', name: 'Slate', hex: '#64748b' },
    { id: 'gray', name: 'Gray', hex: '#6b7280' },
    { id: 'zinc', name: 'Zinc', hex: '#71717a' },
    { id: 'neutral', name: 'Neutral', hex: '#737373' },
    { id: 'stone', name: 'Stone', hex: '#78716c' },
    { id: 'white', name: 'White', hex: '#ffffff' },
    { id: 'black', name: 'Black', hex: '#000000' },
    { id: 'dark-blue', name: 'Dark Blue', hex: '#1e3a8a' },
    { id: 'dark-green', name: 'Dark Green', hex: '#166534' },
    { id: 'dark-red', name: 'Dark Red', hex: '#991b1b' }
  ];

  getCurrentColor() {
    return this.currentColor.asReadonly();
  }

  setBackgroundColor(hex: string) {
    this.currentColor.set(hex);
    this.applyBackgroundToBody(hex);
  }

  setBackgroundById(id: string) {
    const color = this.colorPalette.find(c => c.id === id);
    if (color) {
      this.setBackgroundColor(color.hex);
    }
  }

  private applyBackgroundToBody(hex: string) {
    const bodyElement = document.body;
    const appContainer = document.querySelector('.app-container') as HTMLElement;
    
    // Clear existing background styles from both body and app container
    bodyElement.style.removeProperty('background');
    bodyElement.style.removeProperty('background-image');
    bodyElement.style.backgroundColor = hex;
    
    if (appContainer) {
      appContainer.style.removeProperty('background');
      appContainer.style.removeProperty('background-image');
      appContainer.style.backgroundColor = hex;
    }
  }

  initializeBackground(hex: string) {
    this.setBackgroundColor(hex);
  }
}