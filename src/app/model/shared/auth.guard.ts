import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
} from '@angular/router';
import { map, Observable, take } from 'rxjs';
import { NgToastService } from 'ng-angular-popup';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  constructor(
    public authService: AuthService,
    public router: Router,
    private toast: NgToastService 
  ) {}

  canActivate(
    _next: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        if (user) {
          return true;
        }

        this.toast.error({
          detail: 'Erro!',
          summary: 'Acesso negado!',
          duration: 5000
        });
        return this.router.createUrlTree(['']);
      })
    );
  }
}
