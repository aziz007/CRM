import { InjectionToken } from '@angular/core';

/** Base URL of the CRM API. Override the default in app.config.ts for other environments. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:4000/api/v1',
});
