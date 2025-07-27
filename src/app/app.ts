import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { BackgroundService } from './shared/services/background.service';
import { StorageService } from './shared/services/storage.service';
import { AppSettings } from './shared/interfaces/settings.interface';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected title = 'HonqueDoro';
  isLoggedIn = signal<boolean>(false);

  auth = inject(Auth, { optional: true });
  private backgroundService = inject(BackgroundService);
  private storageService = inject(StorageService);
  
  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Initialize background from saved settings
    this.initializeBackground();
    
    if (this.auth) {
      onAuthStateChanged(this.auth, (user) => {
        this.isLoggedIn.set(!!user);
        if (user) {
          this.router.navigate(['/dashboard']);
        }
      });
    }
  }

  private initializeBackground(): void {
    const savedSettings = this.storageService.getSettings<AppSettings>();
    if (savedSettings && savedSettings.backgroundColor) {
      this.backgroundService.initializeBackground(savedSettings.backgroundColor);
    }
  }

  async logout() {
    if (!this.auth) return;
    try {
      await this.auth.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed', error);
    }
  }
}
