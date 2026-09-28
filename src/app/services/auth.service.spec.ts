import { TestBed } from '@angular/core/testing';
import { ɵAngularFireSchedulers } from '@angular/fire';
import {
  Auth,
  EmailAuthProvider,
  User as FirebaseUser,
} from '@angular/fire/auth';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

interface AuthDouble {
  currentUser: FirebaseUser | null;
  app: object;
  onAuthStateChanged: jasmine.Spy;
  signOut: jasmine.Spy;
}

describe('AuthService', () => {
  let auth: AuthDouble;
  let router: jasmine.SpyObj<Router>;
  let emitAuthState: (user: FirebaseUser | null) => void;

  function createService(initialUser: FirebaseUser | null = null): AuthService {
    auth = {
      currentUser: initialUser,
      app: {},
      onAuthStateChanged: jasmine.createSpy('onAuthStateChanged'),
      signOut: jasmine.createSpy('signOut'),
    };
    auth.onAuthStateChanged.and.callFake(
      (next: (user: FirebaseUser | null) => void) => {
        emitAuthState = next;
        next(initialUser);
        return jasmine.createSpy('unsubscribeAuthState');
      }
    );

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: auth as unknown as Auth },
        { provide: Router, useValue: router },
      ],
    });

    // The modular AngularFire wrappers require their zone schedulers even with
    // a fully local Auth test double.
    TestBed.inject(ɵAngularFireSchedulers);
    return TestBed.inject(AuthService);
  }

  afterEach(() => {
    localStorage.removeItem('user');
  });

  it('uses the current Firebase user as its synchronous login state', () => {
    const firebaseUser = { uid: 'authenticated-user' } as FirebaseUser;

    const service = createService(firebaseUser);

    expect(service).toBeTruthy();
    expect(service.isLoggedIn).toBeTrue();
  });

  it('publishes auth changes and keeps isLoggedIn in sync without localStorage', done => {
    localStorage.setItem('user', JSON.stringify({ uid: 'forged-user' }));
    const getItem = spyOn(localStorage, 'getItem').and.callThrough();
    const setItem = spyOn(localStorage, 'setItem').and.callThrough();
    const removeItem = spyOn(localStorage, 'removeItem').and.callThrough();
    const service = createService(null);
    const firebaseUser = { uid: 'firebase-user' } as FirebaseUser;
    const observed: Array<FirebaseUser | null> = [];
    const subscription = service.user$.subscribe({
      next: user => {
        observed.push(user);

        if (observed.length === 1) {
          expect(service.isLoggedIn).toBeFalse();
          expect(observed).toEqual([null]);
          emitAuthState(firebaseUser);
          return;
        }

        if (observed.length === 2) {
          expect(service.isLoggedIn).toBeTrue();
          expect(observed).toEqual([null, firebaseUser]);
          emitAuthState(null);
          return;
        }

        expect(service.isLoggedIn).toBeFalse();
        expect(observed).toEqual([null, firebaseUser, null]);
        expect(auth.onAuthStateChanged).toHaveBeenCalledTimes(1);
        expect(getItem).not.toHaveBeenCalled();
        expect(setItem).not.toHaveBeenCalled();
        expect(removeItem).not.toHaveBeenCalled();
        subscription.unsubscribe();
        done();
      },
      error: done.fail,
    });
  });

  it('delegates login to the modular email/password API with the supplied credentials', () => {
    const service = createService();
    const stopBeforeNetwork = new Error('credentials captured');
    const credential = spyOn(EmailAuthProvider, 'credential').and.callFake(() => {
      throw stopBeforeNetwork;
    });

    expect(() =>
      service.login({ email: 'listener@example.com', senha: 'secret-pass' })
    ).toThrow(stopBeforeNetwork);
    expect(credential).toHaveBeenCalledOnceWith(
      'listener@example.com',
      'secret-pass'
    );
  });

  it('signs out through Firebase, clears the in-memory state and then redirects', async () => {
    const firebaseUser = { uid: 'authenticated-user' } as FirebaseUser;
    const service = createService(firebaseUser);
    auth.signOut.and.resolveTo();

    await service.deslogar();

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(service.isLoggedIn).toBeFalse();
    expect(router.navigate).toHaveBeenCalledOnceWith(['']);
  });

  it('does not redirect or discard the current user when Firebase sign-out fails', async () => {
    const firebaseUser = { uid: 'authenticated-user' } as FirebaseUser;
    const service = createService(firebaseUser);
    const firebaseError = new Error('sign-out failed');
    auth.signOut.and.rejectWith(firebaseError);

    await expectAsync(service.deslogar()).toBeRejectedWith(firebaseError);

    expect(service.isLoggedIn).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
