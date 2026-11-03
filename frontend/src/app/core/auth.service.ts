import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { LoginResponse, Role, User } from './models';

const TOKEN_KEY = 'crm.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBase = inject(API_BASE_URL);

  private readonly _user = signal<User | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  hasRole(...roles: Role[]): boolean {
    const user = this._user();
    return !!user && roles.includes(user.role);
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${this.apiBase}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.token);
          this._user.set(res.user);
        })
      );
  }

  /** Restores the session on app start. Resolves to true if a valid session exists. */
  async restoreSession(): Promise<boolean> {
    if (!this.token) {
      return false;
    }
    try {
      const res = await firstValueFrom(this.http.get<{ user: User }>(`${this.apiBase}/auth/me`));
      this._user.set(res.user);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  logout(redirect = true): void {
    this.clearSession();
    if (redirect) {
      this.router.navigateByUrl('/login');
    }
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
  }
}
