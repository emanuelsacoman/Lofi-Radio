import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {
  private readonly connectedUsersCountSubject = new BehaviorSubject<number>(0);
  private readonly subscriptions = new Subscription();

  constructor(
    private db: AngularFireDatabase
  ) {
    this.subscriptions.add(
      this.db.object<number>('analyticsPublic/onlineCount').valueChanges().subscribe(count => {
        this.connectedUsersCountSubject.next(
          typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0
        );
      })
    );
  }

  getConnectedUsersCount(): Observable<number> {
    return this.connectedUsersCountSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.connectedUsersCountSubject.complete();
  }
}
