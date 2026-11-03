import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Use with route data: { roles: ['admin'] }. Must be placed after authGuard. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] as Role[] | undefined) ?? [];
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.hasRole(...roles) ? true : router.createUrlTree(['/']);
};
