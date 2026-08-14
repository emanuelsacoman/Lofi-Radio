import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {
  private readonly connectedUsersCountSubject = new BehaviorSubject<number>(0);
  private readonly subscriptions = new Subscription();
  private readonly userId: string;
  private readonly connectionId: string;
  private readonly presencePath: string;

  constructor(
    private db: AngularFireDatabase
  ) {
    this.userId = this.getOrCreateVisitorId();
    this.connectionId = `connection_${this.generateRandomId()}`;
    // Keep the existing top-level boolean schema while giving each live
    // connection its own key, so an old onDisconnect cannot remove a new one.
    this.presencePath = `connectedUsers/${this.userId}_${this.connectionId}`;

    this.subscriptions.add(
      this.db.object<boolean>('.info/connected').valueChanges().subscribe(isConnected => {
        if (isConnected) {
          void this.registerPresence();
        }
      })
    );

    this.subscriptions.add(
      this.db.object<Record<string, unknown>>('connectedUsers').valueChanges().subscribe(users => {
        this.connectedUsersCountSubject.next(users ? Object.keys(users).length : 0);
      })
    );
  }

  private generateVisitorId(): string {
    return `visitor_${this.generateRandomId()}`;
  }

  private generateRandomId(): string {
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
    return randomId;
  }

  private getOrCreateVisitorId(): string {
    try {
      const storedId = sessionStorage.getItem('visitorId');

      if (storedId) {
        return storedId;
      }

      const visitorId = this.generateVisitorId();
      sessionStorage.setItem('visitorId', visitorId);
      return visitorId;
    } catch {
      return this.generateVisitorId();
    }
  }

  private async registerPresence(): Promise<void> {
    const userRef = this.db.database.ref(this.presencePath);

    try {
      await userRef.onDisconnect().remove();
      await userRef.set(true);
    } catch {
      // Presence is best-effort and retries on the next connection event.
    }
  }

  getConnectedUsersCount(): Observable<number> {
    return this.connectedUsersCountSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.connectedUsersCountSubject.complete();
    void this.db.object(this.presencePath).remove().catch(() => undefined);
  }
}
