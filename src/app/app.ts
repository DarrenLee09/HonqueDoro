import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected title = 'PomodoroFlow';
  isLoggedIn: boolean = false;

  auth = inject(Auth, { optional: true });
  constructor(private router: Router) {}

  ngOnInit() {
    if (this.auth) {
      onAuthStateChanged(this.auth, (user) => {
        this.isLoggedIn = !!user;
        if (user) {
          this.router.navigate(['/dashboard']);
        }
      });
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
