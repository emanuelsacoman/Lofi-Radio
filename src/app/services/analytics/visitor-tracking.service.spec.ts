import { Subject } from 'rxjs';

import { VisitorTrackingService } from './visitor-tracking.service';

describe('VisitorTrackingService', () => {
  let connected$: Subject<boolean>;
  let removeSpy: jasmine.Spy;
  let cancelSpy: jasmine.Spy;
  let refSpy: jasmine.Spy;
  let service: VisitorTrackingService;

  beforeEach(() => {
    sessionStorage.clear();
    connected$ = new Subject<boolean>();
    removeSpy = jasmine.createSpy('remove').and.resolveTo();
    cancelSpy = jasmine.createSpy('cancel').and.resolveTo();
    refSpy = jasmine.createSpy('ref').and.returnValue({
      onDisconnect: () => ({ remove: removeSpy, cancel: cancelSpy }),
      remove: removeSpy,
      set: jasmine.createSpy('set').and.resolveTo()
    });

    service = new VisitorTrackingService({
      object: () => ({ valueChanges: () => connected$.asObservable() }),
      database: { ref: refSpy }
    } as any, {} as any);
  });

  afterEach(() => {
    service.stop();
    sessionStorage.clear();
  });

  it('does not subscribe more than once and tears presence down on stop', () => {
    service.start();
    service.start();

    expect(connected$.observers.length).toBe(1);

    service.stop();

    expect(connected$.observers.length).toBe(0);
    expect(refSpy.calls.mostRecent().args[0]).toMatch(/^visitorAnalytics\/live\/connection_/);
    expect(cancelSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('waits for a realtime connection before preparing presence', async () => {
    service.start();
    connected$.next(false);
    await Promise.resolve();

    expect(refSpy).not.toHaveBeenCalled();

    connected$.next(true);
    await Promise.resolve();

    expect(refSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
