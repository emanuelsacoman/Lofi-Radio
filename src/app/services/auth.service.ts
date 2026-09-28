import { Injectable } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, User as FirebaseUser } from '@angular/fire/auth';
import { User } from './interfaces/user';
import { Router } from '@angular/router';
import { Observable, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly user$: Observable<FirebaseUser | null>;
  private currentUser: FirebaseUser | null;

  constructor(
    private auth: Auth,
    public router: Router
  ) {
    this.currentUser = this.auth.currentUser;
    this.user$ = authState(this.auth).pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.user$.subscribe(user => this.currentUser = user);
  }

  get isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  login({email, senha}: User) {
    return signInWithEmailAndPassword(this.auth, email, senha);
  }

  public deslogar(): Promise<void> {
    return signOut(this.auth).then(() => {
      this.currentUser = null;
      return this.router.navigate(['']).then(() => undefined);
    });
  }
}
