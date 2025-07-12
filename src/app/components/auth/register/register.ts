import { Component } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    FormsModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  email: string = '';
  password: string = '';

  constructor(private auth: Auth, private router: Router) {}

  async register() {
    await createUserWithEmailAndPassword(this.auth, this.email, this.password);
    await signInWithEmailAndPassword(this.auth, this.email, this.password);
    await this.router.navigate(['/dashboard']);
  }
}
