import { Component } from '@angular/core';
import { RouterLink, Router } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email: string = '';
  password: string = '';

  constructor(private auth: Auth, private router: Router) {}

  async login() {
    const userCredential = await signInWithEmailAndPassword(this.auth, this.email, this.password);
    await this.router.navigate(['/dashboard']);
  }
}
