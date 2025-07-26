import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword, AuthError } from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email: string = '';
  password: string = '';
  
  // Signals for UI state
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  auth = inject(Auth, { optional: true });
  constructor(private router: Router) {}

  async login() {
    if (!this.auth) {
      this.errorMessage.set('Firebase not configured. Using demo mode - redirecting to dashboard...');
      // For demo purposes, allow login without Firebase
      setTimeout(async () => {
        await this.router.navigate(['/dashboard']);
      }, 1500);
      return;
    }
    
    // Basic validation
    if (!this.email.trim()) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }
    
    if (!this.password.trim()) {
      this.errorMessage.set('Please enter your password.');
      return;
    }
    
    if (!this.isValidEmail(this.email)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }
    
    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, this.email.trim(), this.password);
      console.log('Login successful:', userCredential.user.email);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Login error:', error);
      this.handleAuthError(error as AuthError);
    } finally {
      this.isLoading.set(false);
    }
  }
  
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  private handleAuthError(error: AuthError): void {
    switch (error.code) {
      case 'auth/user-not-found':
        this.errorMessage.set('No account found with this email address.');
        break;
      case 'auth/wrong-password':
        this.errorMessage.set('Incorrect password. Please try again.');
        break;
      case 'auth/invalid-email':
        this.errorMessage.set('Invalid email address format.');
        break;
      case 'auth/user-disabled':
        this.errorMessage.set('This account has been disabled.');
        break;
      case 'auth/too-many-requests':
        this.errorMessage.set('Too many failed attempts. Please try again later.');
        break;
      case 'auth/network-request-failed':
        this.errorMessage.set('Network error. Please check your connection.');
        break;
      default:
        this.errorMessage.set('Login failed. Please try again.');
        break;
    }
  }
}
