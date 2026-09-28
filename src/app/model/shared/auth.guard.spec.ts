import { User as FirebaseUser } from '@angular/fire/auth';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { NgToastService } from 'ng-angular-popup';
import { Observable, Subject } from 'rxjs';

import { AuthService } from 'src/app/services/auth.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let authState: Subject<FirebaseUser | null>;
  let authService: Pick<AuthService, 'user$' | 'isLoggedIn'>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<NgToastService>;
  let guard: AuthGuard;
  let redirectTree: UrlTree;

  function activate(): Observable<boolean | UrlTree> {
    return guard.canActivate(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot
    ) as Observable<boolean | UrlTree>;
  }

  beforeEach(() => {
    authState = new Subject<FirebaseUser | null>();
    authService = {
      user$: authState.asObservable(),
      isLoggedIn: false,
    };
    redirectTree = {} as UrlTree;
    router = jasmine.createSpyObj<Router>('Router', [
      'createUrlTree',
      'navigate',
    ]);
    router.createUrlTree.and.returnValue(redirectTree);
    toast = jasmine.createSpyObj<NgToastService>('NgToastService', ['error']);
    guard = new AuthGuard(authService as AuthService, router, toast);
  });

  afterEach(() => {
    localStorage.removeItem('user');
  });

  it('waits for Firebase auth to resolve before making a routing decision', () => {
    let result: boolean | UrlTree | undefined;
    let completed = false;

    activate().subscribe({
      next: value => (result = value),
      complete: () => (completed = true),
    });

    expect(result).toBeUndefined();
    expect(completed).toBeFalse();
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.createUrlTree).not.toHaveBeenCalled();

    authState.next({ uid: 'authenticated-user' } as FirebaseUser);

    expect(result).toBeTrue();
    expect(completed).toBeTrue();
  });

  it('allows the Firebase user and consumes only the first auth emission', () => {
    const results: Array<boolean | UrlTree> = [];
    activate().subscribe(value => results.push(value));

    authState.next({ uid: 'authenticated-user' } as FirebaseUser);
    authState.next(null);

    expect(results).toEqual([true]);
    expect(toast.error).not.toHaveBeenCalled();
    expect(router.createUrlTree).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('returns a UrlTree and shows one denial toast for an anonymous user', () => {
    const results: Array<boolean | UrlTree> = [];
    activate().subscribe(value => results.push(value));

    authState.next(null);
    authState.next(null);

    expect(results).toEqual([redirectTree]);
    expect(router.createUrlTree).toHaveBeenCalledOnceWith(['']);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnceWith({
      detail: 'Erro!',
      summary: 'Acesso negado!',
      duration: 5000,
    });
  });

  it('does not trust a forged localStorage session', () => {
    localStorage.setItem('user', JSON.stringify({ uid: 'forged-user' }));
    const results: Array<boolean | UrlTree> = [];
    activate().subscribe(value => results.push(value));

    authState.next(null);

    expect(results).toEqual([redirectTree]);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('allows a real Firebase user even when localStorage contains a stale logout', () => {
    localStorage.setItem('user', 'null');
    const results: Array<boolean | UrlTree> = [];
    activate().subscribe(value => results.push(value));

    authState.next({ uid: 'real-user' } as FirebaseUser);

    expect(results).toEqual([true]);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
