import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {
  private connectedUsersCountSubject: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private userId: string | null = null;
  private connectedUsersCountSubscription: Subscription | null = null;

  constructor(
    private db: AngularFireDatabase,
  ) {
    this.userId = localStorage.getItem('visitorId');
    if (!this.userId) {
      this.userId = this.generateVisitorId();
      localStorage.setItem('visitorId', this.userId);
    }
    
    this.setConnectionState(this.userId);

    this.connectedUsersCountSubscription = this.db.object('connectedUsers').valueChanges().subscribe((users: any) => {
      const userCount = users ? Object.keys(users).length : 0;
      this.connectedUsersCountSubject.next(userCount);
    });
  }

  private generateVisitorId(): string {
    return 'visitor_' + Math.random().toString(36).substr(2, 9);
  }

  private setConnectionState(userId: string | null) {
    if (userId) {
      this.addUserToConnectedList(userId);
    } else {
      this.removeUserFromConnectedList();
    }
  }

  private addUserToConnectedList(userId: string) {
    const userRef = this.db.object(`connectedUsers/${userId}`);
    userRef.set(true);
    const userRefNative = this.db.database.ref(`connectedUsers/${userId}`);
    userRefNative.onDisconnect().remove();
  }

  private removeUserFromConnectedList() {
    if (this.userId) {
      this.db.object(`connectedUsers/${this.userId}`).remove();
    }
  }

  getConnectedUsersCount() {
    return this.connectedUsersCountSubject.asObservable();
  }

  ngOnDestroy() {
    if (this.connectedUsersCountSubscription) {
      this.connectedUsersCountSubscription.unsubscribe();
    }
  }
}
