// src/app/features/operator-portal/operator.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserResponse } from '../../core/services/user.service';

export const ROLE_ROUTES: Record<UserResponse['role'], string> = {
  MACHINE_OPERATOR: '/portal/machine-operator',
  PACKING_OPERATOR: '/portal/packing-operator',
  SALES:            '/portal/sales-operator',
  ADMIN:            '/dashboard',
};

export function operatorGuard(requiredRole: UserResponse['role']): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    const auth   = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      // replaceUrl: true — don't add login page on top of history
      router.navigate(
        [`/portal/${requiredRole.toLowerCase().replace('_', '-')}/login`],
        { replaceUrl: true }
      );
      return false;
    }

    const role = auth.currentUser()?.role;

    if (role === 'ADMIN') {
      router.navigate(['/dashboard'], { replaceUrl: true });
      return false;
    }

    if (role === requiredRole) return true;

    // Wrong operator role — replace history so back button works naturally
    router.navigate(
      [ROLE_ROUTES[role!] ?? '/portal/machine-operator/login'],
      { replaceUrl: true }   // ← key fix: replaces instead of pushing
    );
    return false;
  };
}