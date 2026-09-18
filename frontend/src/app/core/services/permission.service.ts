import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';
import { ApiResponse } from '../models/api-response';
import { PageDef, RolePermission } from '../models/page-permission';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly baseUrl = `${environment.apiUrl}/permissions`;

  private readonly _myPages = signal<string[]>([]);
  readonly myPages = this._myPages.asReadonly();

  private loadRequest$: Observable<string[]> | null = null;
  private lastLoadedUserId: number | null = null;   // 👈 use number (matches userId)

  // Ordered the same as the sidebar nav — first match wins when redirecting
  // a user to the first page they're actually allowed to see.
  private readonly navOrder: string[] = [
    'dashboard', 'sales', 'customers', 'inventory', 'material-store',
    'notifications', 'user-management', 'budget', 'flow-money',
    'milling-analysis', 'order-management',
  ];

  constructor(private http: HttpClient, private authService: AuthService) {}

  /** Loads the current user's allowed pages, fetching fresh if user changed or not cached. */
  ensureLoaded(): Observable<string[]> {
    // Admin gets full access – no need to load
    if (this.authService.isAdmin()) {
      this._myPages.set([]);
      return of([]);
    }

    const currentUser = this.authService.currentUser();
    const currentUserId = currentUser?.userId ?? null;

    // If the user changed, reset cache so we fetch fresh data
    if (this.lastLoadedUserId !== currentUserId) {
      this.reset();
      this.lastLoadedUserId = currentUserId;
    }

    // If already loaded and not reset, return cached observable
    if (this.loadRequest$) {
      return this.loadRequest$;
    }

    // First load for this user (or after reset)
    this.loadRequest$ = this.http.get<ApiResponse<string[]>>(`${this.baseUrl}/me`).pipe(
      map(res => res.data),
      tap(pages => this._myPages.set(pages)),
      shareReplay(1)
    );
    return this.loadRequest$;
  }

  /** Call on login/logout so the next user's permissions get refetched. */
  reset() {
    this.loadRequest$ = null;
    this._myPages.set([]);
    // lastLoadedUserId is preserved to detect user changes
  }

  /** Force a full cache reset (e.g. on logout) */
  clearCache() {
    this.reset();
    this.lastLoadedUserId = null;
  }

  canAccess(pageKey: string): boolean {
    if (this.authService.isAdmin()) return true;
    return this._myPages().includes(pageKey);
  }

  /**
   * Returns the route path ('/sales', '/dashboard', etc.) of the first page
   * this user can access, in nav order — or null if they have none.
   * Call this only after ensureLoaded() has resolved (or for an admin,
   * where it's not needed since canAccess() always returns true for them).
   */
  getFirstAccessibleRoute(): string | null {
    if (this.authService.isAdmin()) return '/dashboard';
    for (const key of this.navOrder) {
      if (this.canAccess(key)) return '/' + key;
    }
    return null;
  }

  getAllPages(): Observable<ApiResponse<PageDef[]>> {
    return this.http.get<ApiResponse<PageDef[]>>(`${this.baseUrl}/pages`);
  }

  getMatrix(): Observable<ApiResponse<RolePermission[]>> {
    return this.http.get<ApiResponse<RolePermission[]>>(this.baseUrl);
  }

  updateMatrix(matrix: RolePermission[]): Observable<ApiResponse<RolePermission[]>> {
    return this.http.put<ApiResponse<RolePermission[]>>(this.baseUrl, { matrix });
  }
}