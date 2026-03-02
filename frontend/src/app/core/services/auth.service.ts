// src/app/core/services/auth.service.ts
import { Injectable, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';     
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackendResponse, ErrorAuthResponse, LoginRequest, SuccessAuthResponse, User } from '../models/user';
import { NotificationService } from './notification.service';
import { PushNotificationService } from './push-notification.service';

const TOKEN_KEY = 'mfm_token';
const USER_KEY  = 'mfm_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl   = `${environment.apiUrl}/auth`;
  private readonly isBrowser: boolean;

  private _currentUser = signal<User | null>(null);
  private _token       = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn  = computed(() => !!this._token());
  readonly isAdmin     = computed(() => this._currentUser()?.role === 'ADMIN');

  constructor(
    private http:                HttpClient,
    private router:              Router,
    private notificationService: NotificationService,
    private pushService:         PushNotificationService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this._token.set(localStorage.getItem(TOKEN_KEY));
      this._currentUser.set(this.loadUserFromStorage());
      // Note: app.component.ts calls connect() on refresh — no need here
    }
  }

  // ── Login ────────────────────────────────────────────────────────────────
  login(request: LoginRequest): Observable<SuccessAuthResponse> {
    return this.http.post<BackendResponse>(`${this.apiUrl}/login`, request).pipe(
      map(response => {
        if (
          'data' in response &&
          'token' in response.data &&
          'user'  in response.data &&
          response.data.user
        ) {
          const successData = response.data;

          // 1️⃣ Save token first
          if (this.isBrowser) {
            localStorage.setItem(TOKEN_KEY, successData.token);
            localStorage.setItem(USER_KEY,  JSON.stringify(successData.user));
          }

          // 2️⃣ Update signals
          this._token.set(successData.token);
          this._currentUser.set(successData.user);

          // 3️⃣ Connect socket & request push permission (token now exists)
          this.notificationService.connect();
          this.pushService.requestPermissionAndSubscribe();

          return successData;
        } else {
          const errMsg = (response as ErrorAuthResponse).message || 'Login failed. Please try again.';
          throw new Error(errMsg);
        }
      })
    );
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  logout(): void {
    // 1️⃣ Disconnect socket before clearing token
    this.notificationService.disconnect();   // ← added

    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    this._token.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getToken(): string | null {
    return this._token();
  }

  private loadUserFromStorage(): User | null {
    if (!this.isBrowser) return null;

    const raw = localStorage.getItem(USER_KEY);
    if (!raw || raw === 'undefined' || raw === 'null') {
      localStorage.removeItem(USER_KEY);
      return null;
    }

    try {
      const user = JSON.parse(raw);
      if (!user || typeof user !== 'object') throw new Error('Invalid user data');
      return user;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
  
}
