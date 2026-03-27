// src/app/features/operator-portal/portal.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export const portalGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return true;

  if (auth.isAdmin()) {
    router.navigate(['/dashboard'], { replaceUrl: true }); // ← replaceUrl
    return false;
  }

  return true;
};