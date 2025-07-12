import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Timer } from './components/timer/timer';
import { Settings } from './components/settings/settings';
import { Statistics } from './components/statistics/statistics';
import { Login } from './components/auth/login/login';
import { Register } from './components/auth/register/register';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'timer', component: Timer },
  { path: 'settings', component: Settings },
  { path: 'statistics', component: Statistics },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: '**', redirectTo: '/dashboard' }
];
