import { Injectable, OnDestroy } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Subscription } from 'rxjs';

import { VisitorDeviceCategory } from './visitor-analytics.models';

interface RegisterVisitRequest {
  sessionId: string;
  connectionId: string;
  path: string;
  referrerHost: string;
  language: string;
  deviceCategory: VisitorDeviceCategory;
}

@Injectable({
  providedIn: 'root'
})
export class VisitorTrackingService implements OnDestroy {
  private readonly sessionStorageKey = 'lofi.analytics.session';
  private readonly heartbeatIntervalMs = 45_000;
  private readonly registrationRetryMs = 15_000;
  private readonly sessionId = this.getOrCreateSessionId();
  private connectionSubscription?: Subscription;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private registrationRetryTimer?: ReturnType<typeof setTimeout>;
  private connectionId: string | null = null;
  private isStarted = false;
  private registeringConnectionId: string | null = null;

  constructor(
    private readonly database: AngularFireDatabase,
    private readonly functions: Functions
  ) {}

  start(): void {
    if (this.isStarted || typeof window === 'undefined') {
      return;
    }

    this.isStarted = true;
    this.connectionId = this.createId('connection');
    this.connectionSubscription = this.database
      .object<boolean>('.info/connected')
      .valueChanges()
      .subscribe(isConnected => {
        if (isConnected) {
          void this.registerConnection();
          return;
        }

        this.stopHeartbeat();
      });
  }

  stop(): void {
    if (!this.isStarted) {
      return;
    }

    const connectionId = this.connectionId;
    this.isStarted = false;
    this.connectionId = null;

    if (this.registeringConnectionId === connectionId) {
      this.registeringConnectionId = null;
    }

    this.connectionSubscription?.unsubscribe();
    this.connectionSubscription = undefined;
    this.stopHeartbeat();
    this.stopRegistrationRetry();

    if (!connectionId) {
      return;
    }

    const presenceRef = this.database.database.ref(this.getPresencePath(connectionId));
    void presenceRef.onDisconnect().cancel().catch(() => undefined);
    void presenceRef.remove().catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async registerConnection(): Promise<void> {
    const connectionId = this.connectionId;

    if (!this.isStarted || !connectionId || this.registeringConnectionId === connectionId) {
      return;
    }

    this.registeringConnectionId = connectionId;
    this.stopRegistrationRetry();
    const presencePath = this.getPresencePath(connectionId);
    const presenceRef = this.database.database.ref(presencePath);

    try {
      // The server-side disconnect handler is armed before the presence node is
      // created, avoiding an orphan if the tab closes during registration.
      await presenceRef.onDisconnect().remove();

      const registerVisit = httpsCallable<RegisterVisitRequest, unknown>(
        this.functions,
        'registerVisit'
      );

      await registerVisit({
        sessionId: this.sessionId,
        connectionId,
        path: this.currentPath,
        referrerHost: this.referrerHost,
        language: this.browserLanguage,
        deviceCategory: this.deviceCategory
      });

      if (this.isStarted && this.connectionId === connectionId) {
        this.startHeartbeat(presencePath, connectionId);
      } else {
        await presenceRef.remove();
      }
    } catch {
      // Analytics must never prevent the radio itself from loading. A Firebase
      // reconnect or a short timer will retry while this page is still active.
      this.scheduleRegistrationRetry(connectionId);
    } finally {
      if (this.registeringConnectionId === connectionId) {
        this.registeringConnectionId = null;
      }
    }
  }

  private startHeartbeat(presencePath: string, connectionId: string): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const timestamp = { '.sv': 'timestamp' };
      void this.database.database
        .ref(`${presencePath}/lastSeenAt`)
        .set(timestamp)
        .catch(() => {
          // A background tab can be suspended long enough for server cleanup
          // to remove it. Re-register when the browser becomes active again.
          if (this.isStarted && this.connectionId === connectionId) {
            void this.registerConnection();
          }
        });
    }, this.heartbeatIntervalMs);
  }

  private scheduleRegistrationRetry(connectionId: string): void {
    if (!this.isStarted || this.connectionId !== connectionId || this.registrationRetryTimer) {
      return;
    }

    this.registrationRetryTimer = setTimeout(() => {
      this.registrationRetryTimer = undefined;

      if (this.isStarted && this.connectionId === connectionId) {
        void this.registerConnection();
      }
    }, this.registrationRetryMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private stopRegistrationRetry(): void {
    if (this.registrationRetryTimer) {
      clearTimeout(this.registrationRetryTimer);
      this.registrationRetryTimer = undefined;
    }
  }

  private getPresencePath(connectionId: string): string {
    return `visitorAnalytics/live/${connectionId}`;
  }

  private get currentPath(): string {
    return typeof location === 'undefined' ? '/' : location.pathname.slice(0, 160) || '/';
  }

  private get referrerHost(): string {
    if (typeof document === 'undefined' || !document.referrer) {
      return '';
    }

    try {
      return new URL(document.referrer).hostname.slice(0, 120);
    } catch {
      return '';
    }
  }

  private get browserLanguage(): string {
    return typeof navigator === 'undefined' ? '' : (navigator.language || '').slice(0, 16);
  }

  private get deviceCategory(): VisitorDeviceCategory {
    if (typeof navigator === 'undefined') {
      return 'unknown';
    }

    const userAgent = navigator.userAgent.toLowerCase();

    if (/ipad|tablet|playbook|silk/.test(userAgent)) {
      return 'tablet';
    }

    if (/android|iphone|ipod|mobile/.test(userAgent)) {
      return 'mobile';
    }

    return 'desktop';
  }

  private getOrCreateSessionId(): string {
    try {
      const storedId = sessionStorage.getItem(this.sessionStorageKey);

      if (storedId) {
        return storedId;
      }

      const sessionId = this.createId('session');
      sessionStorage.setItem(this.sessionStorageKey, sessionId);
      return sessionId;
    } catch {
      return this.createId('session');
    }
  }

  private createId(prefix: string): string {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

    return `${prefix}_${randomPart}`;
  }
}
