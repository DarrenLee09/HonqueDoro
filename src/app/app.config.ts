import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { firebaseConfig } from '../environments/environment';

// Only initialize Firebase if we have a valid API key
const hasValidFirebaseConfig = firebaseConfig.apiKey && firebaseConfig.apiKey !== '';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withInterceptorsFromDi()),
    // Only provide Firebase if we have valid config
    ...(hasValidFirebaseConfig ? [
      provideFirebaseApp(() => initializeApp(firebaseConfig)),
      provideAuth(() => getAuth())
    ] : [])
  ]
};
