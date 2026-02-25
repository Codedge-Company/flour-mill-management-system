// src/app/core/services/auth.service.ts (full updated version)
import { Injectable, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackendResponse, ErrorAuthResponse, LoginRequest, SuccessAuthResponse, User } from '../models/user';

const TOKEN_KEY = 'mfm_token';
const USER_KEY  = 'mfm_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly isBrowser: boolean;

  // Signals for reactive state
  private _currentUser = signal<User | null>(null);
  private _token       = signal<string | null>(null);

  readonly currentUser   = this._currentUser.asReadonly();
  readonly isLoggedIn    = computed(() => !!this._token());
  readonly isAdmin       = computed(() => this._currentUser()?.role === 'ADMIN');

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this._token.set(localStorage.getItem(TOKEN_KEY));
      this._currentUser.set(this.loadUserFromStorage());
    }
  }

  login(request: LoginRequest): Observable<SuccessAuthResponse> {
    return this.http.post<BackendResponse>(`${this.apiUrl}/login`, request).pipe(
      map(response => {
        console.log('Raw login response:', response);  // Keep for debugging; remove later if needed
        if ('data' in response && 'token' in response.data && 'user' in response.data && response.data.user) {
          // Success case with wrapper
          const successData = response.data;
          if (this.isBrowser) {
            localStorage.setItem(TOKEN_KEY, successData.token);
            localStorage.setItem(USER_KEY, JSON.stringify(successData.user));
          }
          this._token.set(successData.token);
          this._currentUser.set(successData.user);
          return successData;
        } else {
          // Failure case (if backend sends 200 with error) - throw with backend message if available
          const errMsg = (response as ErrorAuthResponse).message || 'Login failed. Please try again.';
          throw new Error(errMsg);
        }
      })
    );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this._token.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this._token();
  }

  private loadUserFromStorage(): User | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') {
      localStorage.removeItem(USER_KEY); // Clean up invalid value
      return null;
    }
    try {
      const user = JSON.parse(raw);
      if (!user || typeof user !== 'object') {
        throw new Error('Invalid user data');
      }
      return user;
    } catch (e) {
      localStorage.removeItem(USER_KEY); // Clean up corrupted data
      return null;
    }
  }
}