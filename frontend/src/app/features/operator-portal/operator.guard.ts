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
            return router.createUrlTree(['/portal/login'], {
                queryParams: { returnUrl: route.url[0]?.path ?? '' }
            });
        }

        const role = auth.currentUser()?.role;

        if (role === requiredRole) return true;

        // Logged in but wrong role — send to their own page
        return router.createUrlTree([ROLE_ROUTES[role!] ?? '/portal/login']);
    };
}
