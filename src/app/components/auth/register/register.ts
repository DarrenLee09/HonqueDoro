import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';
import {
  Auth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    FormsModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})

export class Register implements OnInit {
  email: string = '';
  password: string = '';

  constructor(private auth: Auth, private router: Router) {}

  ngOnInit() {
    // Check if user is already logged in
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  async register() {
    await createUserWithEmailAndPassword(this.auth, this.email, this.password);
    await signInWithEmailAndPassword(this.auth, this.email, this.password);
    await this.router.navigate(['/dashboard']);
  }
}
