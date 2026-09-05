import { BehaviorSubject } from 'rxjs';

import { VisitorAnalyticsState } from './visitor-analytics.models';
import { VisitorAnalyticsService } from './visitor-analytics.service';

type UnknownRecord = Record<string, unknown>;

describe('VisitorAnalyticsService', () => {
  const now = Date.UTC(2026, 8, 5, 15, 30);

  let liveVisitors$: BehaviorSubject<UnknownRecord | null>;
  let onlineCount$: BehaviorSubject<unknown>;
  let dailyShards$: BehaviorSubject<any[]>;
  let recentVisits$: BehaviorSubject<any[]>;
  let objectSpy: jasmine.Spy;
  let collectionGroupSpy: jasmine.Spy;
  let collectionSpy: jasmine.Spy;
  let dailyWhereSpy: jasmine.Spy;
  let recentOrderBySpy: jasmine.Spy;
  let recentLimitSpy: jasmine.Spy;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(now));

    liveVisitors$ = new BehaviorSubject<UnknownRecord | null>({});
    onlineCount$ = new BehaviorSubject<unknown>(0);
    dailyShards$ = new BehaviorSubject<any[]>([]);
    recentVisits$ = new BehaviorSubject<any[]>([]);

    objectSpy = jasmine.createSpy('database.object').and.callFake((path: string) => ({
      valueChanges: () => path === 'visitorAnalytics/live' ? liveVisitors$ : onlineCount$
    }));

    const dailyQuery: any = {};
    dailyWhereSpy = jasmine.createSpy('daily.where').and.returnValue(dailyQuery);
    dailyQuery.where = dailyWhereSpy;

    collectionGroupSpy = jasmine.createSpy('firestore.collectionGroup').and.callFake(
      (_name: string, query: (ref: any) => unknown) => {
        query(dailyQuery);
        return { valueChanges: () => dailyShards$ };
      }
    );

    recentLimitSpy = jasmine.createSpy('recent.limit').and.returnValue({});
    recentOrderBySpy = jasmine.createSpy('recent.orderBy').and.returnValue({
      limit: recentLimitSpy
    });
    collectionSpy = jasmine.createSpy('firestore.collection').and.callFake(
      (_name: string, query: (ref: any) => unknown) => {
        query({ orderBy: recentOrderBySpy });
        return { snapshotChanges: () => recentVisits$ };
      }
    );
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('uses the expected realtime and Firestore queries', () => {
    createService();

    expect(objectSpy.calls.allArgs().map(args => args[0])).toEqual([
      'visitorAnalytics/live',
      'analyticsPublic/onlineCount'
    ]);
    expect(collectionGroupSpy).toHaveBeenCalledTimes(1);
    expect(collectionGroupSpy.calls.mostRecent().args[0]).toBe('analyticsDailyShards');
    expect(dailyWhereSpy.calls.allArgs()).toEqual([
      ['date', '>=', '2026-08-07'],
      ['date', '<=', '2026-09-05']
    ]);
    expect(collectionSpy.calls.mostRecent().args[0]).toBe('analytics_visits');
    expect(recentOrderBySpy).toHaveBeenCalledOnceWith('visitedAt', 'desc');
    expect(recentLimitSpy).toHaveBeenCalledOnceWith(30);
  });

  it('emits a loading state before the combined dashboard', () => {
    const states: VisitorAnalyticsState[] = [];
    const subscription = createService().dashboard$.subscribe(state => states.push(state));

    expect(states.length).toBe(2);
    expect(states[0].loading).toBeTrue();
    expect(states[0].error).toBeNull();
    expect(states[1].loading).toBeFalse();
    expect(states[1].error).toBeNull();
    subscription.unsubscribe();
  });

  it('fills 30 UTC days and sums shards and countries', () => {
    dailyShards$.next([
      { date: '2026-08-20', visits: 5, countries: { BR: 2, US: '3' } },
      { date: '2026-09-05', visits: '3', countries: { br: 2, US: 1 } },
      { date: '2026-09-05', visits: 4.9, countries: { BR: 1, CA: 2 } },
      { date: '2026-08-06', visits: 100, countries: { FR: 100 } },
      { date: 'invalid', visits: 100, countries: { DE: 100 } }
    ]);

    const state = currentState(createService());
    const dashboard = state.data;

    expect(dashboard.dailyVisits.length).toBe(30);
    expect(dashboard.dailyVisits[0]).toEqual({
      date: '2026-08-07',
      label: '07/08',
      visits: 0
    });
    expect(dashboard.dailyVisits[29]).toEqual({
      date: '2026-09-05',
      label: '05/09',
      visits: 7
    });
    expect(dashboard.visitsToday).toBe(7);
    expect(dashboard.visitsLast30Days).toBe(12);
    expect(dashboard.countriesLast30Days).toBe(3);
    expect(dashboard.countryVisits).toEqual([
      { countryCode: 'BR', visits: 5 },
      { countryCode: 'US', visits: 4 },
      { countryCode: 'CA', visits: 2 }
    ]);
  });

  it('keeps only live visitors seen in the last two minutes and normalizes their data', () => {
    liveVisitors$.next({
      current: {
        sessionId: 'session-current',
        connectedAt: { seconds: (now - 30_000) / 1000 },
        lastSeenAt: now - 10_000,
        path: ' /radio ',
        referrerHost: ' example.com ',
        language: ' pt-BR ',
        deviceCategory: 'mobile',
        geo: {
          city: ' Sao Paulo ',
          region: 'SP',
          country: 'Brazil',
          countryCode: 'br',
          latitude: '-23.55',
          longitude: -46.63,
          timezone: 'America/Sao_Paulo',
          flag: 'BR'
        }
      },
      boundary: {
        connectedAt: now - 180_000,
        lastSeenAt: now - 120_000,
        deviceCategory: 'console'
      },
      stale: {
        connectedAt: now - 200_000,
        lastSeenAt: now - 120_001
      },
      malformed: true
    });
    onlineCount$.next({ count: '9' });

    const dashboard = currentState(createService()).data;

    expect(dashboard.onlineNow).toBe(9);
    expect(dashboard.activeVisitors.map(visitor => visitor.id)).toEqual(['current', 'boundary']);
    expect(dashboard.activeVisitors[0]).toEqual(jasmine.objectContaining({
      sessionId: 'session-current',
      connectedAt: now - 30_000,
      lastSeenAt: now - 10_000,
      path: '/radio',
      referrerHost: 'example.com',
      language: 'pt-BR',
      deviceCategory: 'mobile',
      geo: jasmine.objectContaining({
        city: 'Sao Paulo',
        countryCode: 'BR',
        latitude: -23.55,
        longitude: -46.63
      })
    }));
    expect(dashboard.activeVisitors[1].sessionId).toBe('boundary');
    expect(dashboard.activeVisitors[1].deviceCategory).toBe('unknown');
  });

  it('converts Firestore timestamps and numeric epochs, then orders recent visits', () => {
    recentVisits$.next([
      visitChange('middle', {
        sessionId: 'session-middle',
        visitedAt: { seconds: (now - 20_000) / 1000, nanoseconds: 500_000_000 },
        deviceCategory: 'desktop'
      }),
      visitChange('newest', {
        visitedAt: { toMillis: () => now - 5_000 },
        geo: { latitude: 999, longitude: 'invalid' }
      }),
      visitChange('oldest', {
        visitedAt: (now - 60_000) / 1000,
        deviceCategory: 'tablet'
      })
    ]);

    const visits = currentState(createService()).data.recentVisits;

    expect(visits.map(visit => visit.id)).toEqual(['newest', 'middle', 'oldest']);
    expect(visits[0].visitedAt).toBe(now - 5_000);
    expect(visits[0].sessionId).toBe('newest');
    expect(visits[0].geo.latitude).toBeNull();
    expect(visits[0].geo.longitude).toBeNull();
    expect(visits[1].visitedAt).toBe(now - 19_500);
    expect(visits[2].visitedAt).toBe(now - 60_000);
  });

  it('shares the latest dashboard between subscribers', () => {
    const service = createService();
    let firstState: VisitorAnalyticsState | undefined;
    let secondState: VisitorAnalyticsState | undefined;

    const first = service.dashboard$.subscribe(state => firstState = state);
    const second = service.dashboard$.subscribe(state => secondState = state);

    expect(firstState).toBe(secondState);
    expect(objectSpy).toHaveBeenCalledTimes(2);
    expect(collectionGroupSpy).toHaveBeenCalledTimes(1);
    expect(collectionSpy).toHaveBeenCalledTimes(1);
    first.unsubscribe();
    second.unsubscribe();
  });

  it('turns source failures into a friendly non-loading state', () => {
    const service = createService();
    let state: VisitorAnalyticsState | undefined;
    const subscription = service.dashboard$.subscribe(value => state = value);

    dailyShards$.error(new Error('permission-denied'));

    expect(state?.loading).toBeFalse();
    expect(state?.error).toContain('Não foi possível carregar');
    expect(state?.data.visitsLast30Days).toBe(0);
    expect(state?.data.activeVisitors).toEqual([]);
    subscription.unsubscribe();
  });

  function createService(): VisitorAnalyticsService {
    return new VisitorAnalyticsService(
      { object: objectSpy } as any,
      {
        collectionGroup: collectionGroupSpy,
        collection: collectionSpy
      } as any
    );
  }

  function currentState(service: VisitorAnalyticsService): VisitorAnalyticsState {
    let current: VisitorAnalyticsState | undefined;
    const subscription = service.dashboard$.subscribe(state => current = state);
    subscription.unsubscribe();

    if (!current) {
      throw new Error('The dashboard did not emit a state');
    }

    return current;
  }

  function visitChange(id: string, data: UnknownRecord): any {
    return {
      payload: {
        doc: {
          id,
          data: () => data
        }
      }
    };
  }
});
