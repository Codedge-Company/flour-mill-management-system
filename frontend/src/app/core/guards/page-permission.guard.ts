import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
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

      // Don't hardcode '/dashboard' — the user might not have dashboard
      // access either, which would infinite-loop back into this guard.
      const fallback = permissionService.getFirstAccessibleRoute();
      router.navigate([fallback ?? '/auth/login']);
      return false;
    })
  );
};