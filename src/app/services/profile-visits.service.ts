import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { combineLatest, distinctUntilChanged, firstValueFrom, map, Observable, switchMap, timer } from 'rxjs';
import { getVisitDateKey, ProfileVisitStat } from './interfaces/profile-visit-stat';

interface DailyVisitShard { visits: number; }
interface RegisterVisitInput { sessionId: string; connectionId: string; path: string; }

@Injectable({ providedIn: 'root' })
export class ProfileVisitsService {
  private readonly visitorStorageKey = 'lofi.profileVisitorId';
  // Separate from the former, direct Firestore writer's daily cache.
  private readonly trackedStorageKey = 'lofi.analyticsVisitTrackedDate';
  private visitorId?: string;
  private trackedDate?: string;
  private pending?: Promise<void>;

  constructor(private firestore: AngularFirestore, private functions: AngularFireFunctions) {}

  getProfileVisitStats(): Observable<ProfileVisitStat[]> {
    return timer(0, 60_000).pipe(
      map(() => getVisitDateKey()),
      distinctUntilChanged(),
      switchMap(today => {
        const end = new Date(`${today}T00:00:00Z`);
        // Deployed rules authorize shards, not analytics_daily parent documents.
        // Direct subcollection reads need no additional collection-group index.
        return combineLatest(Array.from({ length: 30 }, (_, index) => {
          const day = new Date(end);
          day.setUTCDate(day.getUTCDate() - 29 + index);
          const date = getVisitDateKey(day);
          return this.firestore.collection<DailyVisitShard>(
            `analytics_daily/${date}/analyticsDailyShards`
          ).valueChanges().pipe(map(shards => ({
            date,
            visits: shards.reduce((sum, shard) => {
              const count = Number(shard.visits);
              return sum + (Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0);
            }, 0)
          })));
        }));
      })
    );
  }

  async registerVisit(): Promise<void> {
    const date = getVisitDateKey();
    if (this.trackedDate === date || this.readStorage(this.trackedStorageKey) === date) return;
    if (this.pending) {
      await this.pending;
      return this.registerVisit();
    }
    this.pending = this.saveVisit(date);
    try {
      await this.pending;
      this.trackedDate = date;
      this.writeStorage(this.trackedStorageKey, date);
    } finally {
      this.pending = undefined;
    }
  }

  private async saveVisit(date: string): Promise<void> {
    const register = this.functions.httpsCallable<RegisterVisitInput, { created: boolean }>('registerVisit');
    // The backend deduplicates sessionId. A browser/day key makes reloads,
    // retries and tabs reuse the same daily visit.
    await firstValueFrom(register({
      sessionId: `${this.getVisitorId()}_${date}`,
      connectionId: `visit_${this.randomId()}`,
      path: '/'
    }));
  }

  private getVisitorId(): string {
    if (!this.visitorId) {
      const stored = this.readStorage(this.visitorStorageKey);
      this.visitorId = stored && /^[a-zA-Z0-9_-]{16,64}$/.test(stored) ? stored : this.randomId();
      this.writeStorage(this.visitorStorageKey, this.visitorId);
    }
    return this.visitorId;
  }

  private randomId(): string {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private readStorage(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private writeStorage(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* Retain the in-memory identity. */ }
  }
}
