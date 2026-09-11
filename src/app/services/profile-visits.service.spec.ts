import { of, Subject, throwError } from 'rxjs';
import { ProfileVisitsService } from './profile-visits.service';
import { ProfileVisitStat } from './interfaces/profile-visit-stat';

describe('ProfileVisitsService', () => {
  let service: ProfileVisitsService;
  let firestore: any;
  let functions: any;
  let register: jasmine.Spy;
  const storageKeys = ['lofi.profileVisitorId', 'lofi.profileVisitTrackedDate', 'lofi.analyticsVisitTrackedDate'];

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-11T23:30:00Z'));
    storageKeys.forEach(key => localStorage.removeItem(key));
    firestore = { collection: jasmine.createSpy().and.returnValue({ valueChanges: () => of([]) }) };
    register = jasmine.createSpy().and.returnValue(of({ created: true }));
    functions = { httpsCallable: jasmine.createSpy().and.returnValue(register) };
    service = new ProfileVisitsService(firestore, functions);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    storageKeys.forEach(key => localStorage.removeItem(key));
  });

  it('calls the deployed function once for simultaneous calls and reloads', async () => {
    await Promise.all([service.registerVisit(), service.registerVisit()]);
    await service.registerVisit();
    await new ProfileVisitsService(firestore, functions).registerVisit();
    expect(functions.httpsCallable).toHaveBeenCalledWith('registerVisit');
    expect(register).toHaveBeenCalledTimes(1);
    const input = register.calls.mostRecent().args[0];
    expect(input.sessionId).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(input.sessionId).toContain('_2026-09-11');
    expect(input.connectionId).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(input.path).toBe('/');
    expect(firestore.collection).not.toHaveBeenCalled();
  });

  it('reuses the browser/day session key if its successful-call cache is absent', async () => {
    await service.registerVisit();
    const firstSession = register.calls.mostRecent().args[0].sessionId;
    localStorage.removeItem('lofi.analyticsVisitTrackedDate');
    register.and.returnValue(of({ created: false }));
    await new ProfileVisitsService(firestore, functions).registerVisit();
    expect(register.calls.mostRecent().args[0].sessionId).toBe(firstSession);
    expect(localStorage.getItem('lofi.analyticsVisitTrackedDate')).toBe('2026-09-11');
  });

  it('does not let the obsolete direct-Firestore cache suppress the new registration', async () => {
    localStorage.setItem('lofi.profileVisitTrackedDate', '2026-09-11');
    await service.registerVisit();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('uses a new daily key after UTC midnight', async () => {
    await service.registerVisit();
    jasmine.clock().mockDate(new Date('2026-09-12T00:01:00Z'));
    await service.registerVisit();
    expect(register).toHaveBeenCalledTimes(2);
    expect(register.calls.mostRecent().args[0].sessionId).toContain('_2026-09-12');
  });

  it('preserves the same session for retries after an unsuccessful response', async () => {
    register.and.returnValue(throwError(() => ({ code: 'functions/unavailable' })));
    await expectAsync(service.registerVisit()).toBeRejected();
    const failedSession = register.calls.mostRecent().args[0].sessionId;
    expect(localStorage.getItem('lofi.analyticsVisitTrackedDate')).toBeNull();
    register.and.returnValue(of({ created: false }));
    await service.registerVisit();
    expect(register.calls.mostRecent().args[0].sessionId).toBe(failedSession);
  });

  it('works when browser storage is unavailable', async () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    await service.registerVisit();
    await service.registerVisit();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('reads only permitted shard subcollections and sums real backend counters', () => {
    firestore.collection.and.callFake((path: string) => ({
      valueChanges: () => of(path.includes('/2026-09-11/')
        ? [{ visits: 3 }, { visits: 7 }, { visits: -1 }, { visits: NaN }] : [])
    }));
    let result: ProfileVisitStat[] = [];
    const subscription = service.getProfileVisitStats().subscribe(stats => result = stats);
    jasmine.clock().tick(1);
    expect(firestore.collection).toHaveBeenCalledTimes(30);
    expect(firestore.collection.calls.first().args[0]).toBe('analytics_daily/2026-08-13/analyticsDailyShards');
    expect(firestore.collection.calls.mostRecent().args[0]).toBe('analytics_daily/2026-09-11/analyticsDailyShards');
    expect(result.length).toBe(30);
    expect(result[0].visits).toBe(0);
    expect(result[29]).toEqual({ date: '2026-09-11', visits: 10 });
    subscription.unsubscribe();
  });

  it('forwards permission errors instead of reporting zero visits', () => {
    const error = { code: 'permission-denied' };
    firestore.collection.and.returnValue({ valueChanges: () => throwError(() => error) });
    const next = jasmine.createSpy();
    const failure = jasmine.createSpy();
    service.getProfileVisitStats().subscribe({ next, error: failure });
    jasmine.clock().tick(1);
    expect(next).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalledWith(error);
  });

  it('renews the UTC window and releases the old listeners', () => {
    const shards = new Subject<any[]>();
    firestore.collection.and.returnValue({ valueChanges: () => shards });
    const subscription = service.getProfileVisitStats().subscribe();
    jasmine.clock().tick(1);
    expect(shards.observed).toBeTrue();
    jasmine.clock().mockDate(new Date('2026-09-12T00:00:00Z'));
    jasmine.clock().tick(60_000);
    expect(firestore.collection).toHaveBeenCalledTimes(60);
    expect(firestore.collection.calls.mostRecent().args[0]).toBe('analytics_daily/2026-09-12/analyticsDailyShards');
    subscription.unsubscribe();
    expect(shards.observed).toBeFalse();
    jasmine.clock().tick(60_000);
    expect(firestore.collection).toHaveBeenCalledTimes(60);
  });
});
