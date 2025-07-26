import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  Auth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  AuthError
} from '@angular/fire/auth';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})

export class Register implements OnInit {
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  
  // Signals for UI state
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  auth = inject(Auth, { optional: true });
  constructor(private router: Router) {}

  ngOnInit() {
    if (this.auth) {
      // Check if user is already logged in
      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.router.navigate(['/dashboard']);
        }
      });
    }
  }

  async register() {
    if (!this.auth) {
      this.errorMessage.set('Firebase not configured. Using demo mode - redirecting to dashboard...');
      // For demo purposes, allow registration without Firebase
      setTimeout(async () => {
        await this.router.navigate(['/dashboard']);
      }, 1500);
      return;
    }
    
    // Validation
    if (!this.email.trim()) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }
    
    if (!this.password.trim()) {
      this.errorMessage.set('Please enter a password.');
      return;
    }
    
    if (this.password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters long.');
      return;
    }
    
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    
    if (!this.isValidEmail(this.email)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }
    
    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.email.trim(), this.password);
      console.log('Registration successful:', userCredential.user.email);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Registration error:', error);
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
      case 'auth/email-already-in-use':
        this.errorMessage.set('An account with this email already exists.');
        break;
      case 'auth/invalid-email':
        this.errorMessage.set('Invalid email address format.');
        break;
      case 'auth/operation-not-allowed':
        this.errorMessage.set('Email/password accounts are not enabled.');
        break;
      case 'auth/weak-password':
        this.errorMessage.set('Password is too weak. Please choose a stronger password.');
        break;
      case 'auth/network-request-failed':
        this.errorMessage.set('Network error. Please check your connection.');
        break;
      default:
        this.errorMessage.set('Registration failed. Please try again.');
        break;
    }
  }
}
