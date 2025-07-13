import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, updateProfile } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  firebaseAuth: Auth | null = inject(Auth, { optional: true });

  register(email: string, username: string, password: string): Observable<any> {
    if (!this.firebaseAuth) {
      throw new Error('Firebase Auth is not available.');
    }
    const promise = signInWithEmailAndPassword(
      this.firebaseAuth,
      email,
      password
    ).then(response => updateProfile(response.user, { displayName: username }));

    return from(promise);
  }
}
