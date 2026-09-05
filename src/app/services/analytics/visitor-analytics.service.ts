import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFirestore, DocumentChangeAction } from '@angular/fire/compat/firestore';
import { Observable, catchError, combineLatest, map, of, shareReplay, startWith } from 'rxjs';

import {
  ActiveVisitor,
  AnalyticsDailyShard,
  CountryVisitSummary,
  DailyVisitPoint,
  VisitRecord,
  VisitorAnalyticsDashboard,
  VisitorAnalyticsState,
  VisitorDeviceCategory,
  VisitorGeo
} from './visitor-analytics.models';

type UnknownRecord = Record<string, unknown>;

@Injectable({
  providedIn: 'root'
})
export class VisitorAnalyticsService {
  private static readonly DAYS_IN_RANGE = 30;
  private static readonly ACTIVE_VISITOR_WINDOW_MS = 2 * 60 * 1000;
  private static readonly RECENT_VISITS_LIMIT = 30;
  private static readonly ERROR_MESSAGE =
    'Não foi possível carregar os dados de visitas. Tente novamente em instantes.';

  readonly dashboard$: Observable<VisitorAnalyticsState>;

  constructor(
    private readonly database: AngularFireDatabase,
    private readonly firestore: AngularFirestore
  ) {
    const dateKeys = this.createUtcDateKeys(Date.now());
    const firstDate = dateKeys[0];
    const lastDate = dateKeys[dateKeys.length - 1];

    const liveVisitors$ = this.database
      .object<UnknownRecord>('visitorAnalytics/live')
      .valueChanges();

    const publicOnlineCount$ = this.database
      .object<unknown>('analyticsPublic/onlineCount')
      .valueChanges();

    const dailyShards$ = this.firestore
      .collectionGroup<AnalyticsDailyShard>('analyticsDailyShards', ref =>
        ref.where('date', '>=', firstDate).where('date', '<=', lastDate)
      )
      .valueChanges();

    const recentVisits$ = this.firestore
      .collection<UnknownRecord>('analytics_visits', ref =>
        ref.orderBy('visitedAt', 'desc').limit(VisitorAnalyticsService.RECENT_VISITS_LIMIT)
      )
      .snapshotChanges();

    this.dashboard$ = combineLatest([
      liveVisitors$,
      publicOnlineCount$,
      dailyShards$,
      recentVisits$
    ]).pipe(
      map(([liveVisitors, publicOnlineCount, dailyShards, recentVisits]) => ({
        loading: false,
        error: null,
        data: this.buildDashboard(
          liveVisitors,
          publicOnlineCount,
          dailyShards,
          recentVisits,
          Date.now()
        )
      })),
      startWith(this.createState(true, null)),
      catchError(() => of(this.createState(false, VisitorAnalyticsService.ERROR_MESSAGE))),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private buildDashboard(
    liveVisitors: UnknownRecord | null,
    publicOnlineCount: unknown,
    dailyShards: AnalyticsDailyShard[],
    recentVisitChanges: DocumentChangeAction<UnknownRecord>[],
    now: number
  ): VisitorAnalyticsDashboard {
    const dateKeys = this.createUtcDateKeys(now);
    const { dailyVisits, countryVisits } = this.aggregateDailyShards(dailyShards, dateKeys);
    const activeVisitors = this.normalizeActiveVisitors(liveVisitors, now);
    const recentVisits = this.normalizeRecentVisits(recentVisitChanges);
    const visitsLast30Days = dailyVisits.reduce((total, point) => total + point.visits, 0);

    return {
      onlineNow: this.normalizeOnlineCount(publicOnlineCount),
      visitsToday: dailyVisits[dailyVisits.length - 1]?.visits || 0,
      visitsLast30Days,
      countriesLast30Days: countryVisits.length,
      dailyVisits,
      countryVisits,
      activeVisitors,
      recentVisits,
      updatedAt: now
    };
  }

  private aggregateDailyShards(
    shards: AnalyticsDailyShard[],
    dateKeys: string[]
  ): { dailyVisits: DailyVisitPoint[]; countryVisits: CountryVisitSummary[] } {
    const visitsByDate = new Map(dateKeys.map(date => [date, 0]));
    const visitsByCountry = new Map<string, number>();

    for (const shard of Array.isArray(shards) ? shards : []) {
      if (!shard || !visitsByDate.has(shard.date)) {
        continue;
      }

      visitsByDate.set(
        shard.date,
        (visitsByDate.get(shard.date) || 0) + this.toCount(shard.visits)
      );

      if (!this.isRecord(shard.countries)) {
        continue;
      }

      for (const [rawCountryCode, rawVisits] of Object.entries(shard.countries)) {
        const countryCode = this.normalizeCountryCode(rawCountryCode);
        const visits = this.toCount(rawVisits);

        if (!countryCode || visits === 0) {
          continue;
        }

        visitsByCountry.set(countryCode, (visitsByCountry.get(countryCode) || 0) + visits);
      }
    }

    const dailyVisits = dateKeys.map(date => ({
      date,
      label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      visits: visitsByDate.get(date) || 0
    }));

    const countryVisits = Array.from(visitsByCountry, ([countryCode, visits]) => ({
      countryCode,
      visits
    })).sort((a, b) => b.visits - a.visits || a.countryCode.localeCompare(b.countryCode));

    return { dailyVisits, countryVisits };
  }

  private normalizeActiveVisitors(liveVisitors: UnknownRecord | null, now: number): ActiveVisitor[] {
    if (!this.isRecord(liveVisitors)) {
      return [];
    }

    const oldestAllowed = now - VisitorAnalyticsService.ACTIVE_VISITOR_WINDOW_MS;

    return Object.entries(liveVisitors)
      .map(([id, value]) => this.normalizeActiveVisitor(id, value))
      .filter((visitor): visitor is ActiveVisitor =>
        visitor !== null && visitor.lastSeenAt >= oldestAllowed
      )
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.id.localeCompare(b.id));
  }

  private normalizeActiveVisitor(id: string, value: unknown): ActiveVisitor | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const connectedAt = this.toTimestampMillis(value['connectedAt']);
    const lastSeenAt = this.toTimestampMillis(value['lastSeenAt']) || connectedAt;

    if (!lastSeenAt) {
      return null;
    }

    return {
      id,
      sessionId: this.toText(value['sessionId']) || id,
      connectedAt: connectedAt || lastSeenAt,
      lastSeenAt,
      path: this.toText(value['path']),
      referrerHost: this.toText(value['referrerHost']),
      language: this.toText(value['language']),
      deviceCategory: this.normalizeDeviceCategory(value['deviceCategory']),
      geo: this.normalizeGeo(value['geo'])
    };
  }

  private normalizeRecentVisits(
    changes: DocumentChangeAction<UnknownRecord>[]
  ): VisitRecord[] {
    return (Array.isArray(changes) ? changes : [])
      .map(change => {
        const document = change?.payload?.doc;

        if (!document) {
          return null;
        }

        const value = document.data();
        const visitedAt = this.toTimestampMillis(value?.['visitedAt']);

        return {
          id: document.id,
          sessionId: this.toText(value?.['sessionId']) || document.id,
          visitedAt,
          path: this.toText(value?.['path']),
          referrerHost: this.toText(value?.['referrerHost']),
          language: this.toText(value?.['language']),
          deviceCategory: this.normalizeDeviceCategory(value?.['deviceCategory']),
          geo: this.normalizeGeo(value?.['geo'])
        } as VisitRecord;
      })
      .filter((visit): visit is VisitRecord => visit !== null)
      .sort((a, b) => b.visitedAt - a.visitedAt || a.id.localeCompare(b.id))
      .slice(0, VisitorAnalyticsService.RECENT_VISITS_LIMIT);
  }

  private normalizeGeo(value: unknown): VisitorGeo {
    const geo = this.isRecord(value) ? value : {};

    return {
      city: this.toText(geo['city']),
      region: this.toText(geo['region']),
      country: this.toText(geo['country']),
      countryCode: this.normalizeCountryCode(geo['countryCode']),
      latitude: this.toCoordinate(geo['latitude'], -90, 90),
      longitude: this.toCoordinate(geo['longitude'], -180, 180),
      timezone: this.toText(geo['timezone']),
      flag: this.toText(geo['flag'])
    };
  }

  private normalizeOnlineCount(value: unknown): number {
    if (this.isRecord(value) && 'count' in value) {
      return this.toCount(value['count']);
    }

    return this.toCount(value);
  }

  private normalizeDeviceCategory(value: unknown): VisitorDeviceCategory {
    return value === 'desktop' || value === 'mobile' || value === 'tablet'
      ? value
      : 'unknown';
  }

  private normalizeCountryCode(value: unknown): string {
    return this.toText(value).toUpperCase().slice(0, 2);
  }

  private toTimestampMillis(value: unknown): number {
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value.getTime() : 0;
    }

    if (this.isRecord(value)) {
      const toMillis = value['toMillis'];

      if (typeof toMillis === 'function') {
        try {
          return this.normalizeEpochNumber(toMillis.call(value));
        } catch {
          return 0;
        }
      }

      const seconds = value['seconds'] ?? value['_seconds'];
      const nanoseconds = value['nanoseconds'] ?? value['_nanoseconds'];
      const secondsNumber = this.toFiniteNumber(seconds);
      const nanosecondsNumber = this.toFiniteNumber(nanoseconds);

      if (secondsNumber !== null) {
        return Math.round(secondsNumber * 1000 + (nanosecondsNumber || 0) / 1_000_000);
      }
    }

    if (typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) {
      const parsedDate = Date.parse(value);
      return Number.isFinite(parsedDate) ? parsedDate : 0;
    }

    return this.normalizeEpochNumber(value);
  }

  private normalizeEpochNumber(value: unknown): number {
    const epoch = this.toFiniteNumber(value);

    if (epoch === null || epoch <= 0) {
      return 0;
    }

    return Math.round(epoch < 100_000_000_000 ? epoch * 1000 : epoch);
  }

  private toCoordinate(value: unknown, min: number, max: number): number | null {
    const coordinate = this.toFiniteNumber(value);
    return coordinate !== null && coordinate >= min && coordinate <= max ? coordinate : null;
  }

  private toCount(value: unknown): number {
    const count = this.toFiniteNumber(value);
    return count === null ? 0 : Math.max(0, Math.trunc(count));
  }

  private toFiniteNumber(value: unknown): number | null {
    const numberValue = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private toText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private createUtcDateKeys(now: number): string[] {
    const today = new Date(now);
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    );

    return Array.from({ length: VisitorAnalyticsService.DAYS_IN_RANGE }, (_, index) => {
      const daysBeforeToday = VisitorAnalyticsService.DAYS_IN_RANGE - index - 1;
      return new Date(todayUtc - daysBeforeToday * 86_400_000).toISOString().slice(0, 10);
    });
  }

  private createState(loading: boolean, error: string | null): VisitorAnalyticsState {
    return {
      loading,
      error,
      data: {
        onlineNow: 0,
        visitsToday: 0,
        visitsLast30Days: 0,
        countriesLast30Days: 0,
        dailyVisits: [],
        countryVisits: [],
        activeVisitors: [],
        recentVisits: [],
        updatedAt: 0
      }
    };
  }
}
