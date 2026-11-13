import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;

  // remember where they were going so login sends them back (home-screen link -> /portal/stock-entry)
  const queryParams = state.url && state.url !== '/' ? { returnUrl: state.url } : undefined;
  return router.createUrlTree(['/auth/login'], { queryParams });
};
