import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const isLoginCall = req.url.endsWith('/auth/login');

  const request = token && !isLoginCall
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      // An expired or revoked token on a protected call logs the user out.
      if (err instanceof HttpErrorResponse && err.status === 401 && !isLoginCall) {
        auth.logout();
      }
      return throwError(() => err);
    })
  );
};
