import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { PermissionService } from '../services/permission.service';
import { AuthService } from '../services/auth.service';

export const pagePermissionGuard: CanActivateFn = (route) => {
  const permissionService = inject(PermissionService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const pageKey = route.data?.['pageKey'] as string;
  if (!pageKey || authService.isAdmin()) return true;

  return permissionService.ensureLoaded().pipe(
    map(() => {
      if (permissionService.canAccess(pageKey)) return true;

      const fallback = permissionService.getFirstAccessibleRoute();
      router.navigate([fallback ?? '/auth/login']);
      return false;
    }),
    // If permissions can't even be loaded (401/expired session/deleted
    // user), don't leave the app hanging on a blank screen - log out and
    // send them back to login instead of letting the error propagate silently.
    catchError(() => {
      authService.logout?.();
      router.navigate(['/auth/login']);
      return of(false);
    })
  );
};