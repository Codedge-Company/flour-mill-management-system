// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const OPERATOR_ROLES = ['MACHINE_OPERATOR', 'PACKING_OPERATOR', 'SALES'];

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/auth/login'], { replaceUrl: true });
    return false;
  }

  const role = auth.currentUser()?.role;

  // Operators must not access the main admin layout
  if (role && OPERATOR_ROLES.includes(role)) {
    const ROLE_ROUTES: Record<string, string> = {
      MACHINE_OPERATOR: '/portal/machine-operator',
      PACKING_OPERATOR: '/portal/packing-operator',
      SALES:            '/portal/sales-operator',
    };
    router.navigate([ROLE_ROUTES[role]], { replaceUrl: true }); // ← replaceUrl
    return false;
  }

  return true;
};