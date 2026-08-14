import { Subject } from 'rxjs';

import { UserService } from './user.service';

describe('UserService presence', () => {
  let connected$: Subject<boolean>;
  let connectedUsers$: Subject<Record<string, unknown> | null>;
  let objectSpy: jasmine.Spy;
  let refSpy: jasmine.Spy;
  let onDisconnectSpy: jasmine.Spy;
  let onDisconnectRemoveSpy: jasmine.Spy;
  let setPresenceSpy: jasmine.Spy;
  let removePresenceSpy: jasmine.Spy;
  let services: UserService[];

  beforeEach(() => {
    sessionStorage.clear();
    connected$ = new Subject<boolean>();
    connectedUsers$ = new Subject<Record<string, unknown> | null>();
    services = [];

    onDisconnectRemoveSpy = jasmine.createSpy('onDisconnect.remove').and.resolveTo();
    onDisconnectSpy = jasmine.createSpy('onDisconnect').and.returnValue({
      remove: onDisconnectRemoveSpy
    });
    setPresenceSpy = jasmine.createSpy('presence.set').and.resolveTo();
    removePresenceSpy = jasmine.createSpy('presence.remove').and.resolveTo();
    refSpy = jasmine.createSpy('database.ref').and.returnValue({
      onDisconnect: onDisconnectSpy,
      set: setPresenceSpy
    });
    objectSpy = jasmine.createSpy('object').and.callFake((path: string) => {
      if (path === '.info/connected') {
        return { valueChanges: () => connected$.asObservable() };
      }

      if (path === 'connectedUsers') {
        return { valueChanges: () => connectedUsers$.asObservable() };
      }

      return { remove: removePresenceSpy };
    });
  });

  afterEach(() => {
    services.forEach(service => service.ngOnDestroy());
    sessionStorage.clear();
  });

  it('reuses the visitor id but creates an isolated entry for every connection', async () => {
    createService();
    const storedVisitorId = sessionStorage.getItem('visitorId');

    expect(storedVisitorId).toMatch(/^visitor_/);

    createService();
    connected$.next(true);
    await flushMicrotasks();

    const paths = refSpy.calls.allArgs().map(args => args[0] as string);
    expect(paths.length).toBe(2);
    expect(paths[0]).toMatch(new RegExp(`^connectedUsers/${storedVisitorId}_connection_`));
    expect(paths[1]).toMatch(new RegExp(`^connectedUsers/${storedVisitorId}_connection_`));
    expect(paths[0]).not.toBe(paths[1]);
  });

  it('waits for Firebase to report a connection before registering presence', async () => {
    createService();

    expect(refSpy).not.toHaveBeenCalled();
    expect(setPresenceSpy).not.toHaveBeenCalled();

    connected$.next(false);
    await flushMicrotasks();

    expect(refSpy).not.toHaveBeenCalled();
    expect(setPresenceSpy).not.toHaveBeenCalled();

    connected$.next(true);
    await flushMicrotasks();

    expect(refSpy).toHaveBeenCalledTimes(1);
    expect(setPresenceSpy).toHaveBeenCalledOnceWith(true);
  });

  it('arms onDisconnect removal before publishing the presence flag', async () => {
    const callOrder: string[] = [];
    let allowDisconnectRegistration!: () => void;

    onDisconnectSpy.and.callFake(() => {
      callOrder.push('onDisconnect');
      return { remove: onDisconnectRemoveSpy };
    });
    onDisconnectRemoveSpy.and.callFake(() => {
      callOrder.push('remove');
      return new Promise<void>(resolve => allowDisconnectRegistration = resolve);
    });
    setPresenceSpy.and.callFake(() => {
      callOrder.push('set');
      return Promise.resolve();
    });

    createService();
    connected$.next(true);

    expect(callOrder).toEqual(['onDisconnect', 'remove']);
    expect(setPresenceSpy).not.toHaveBeenCalled();

    allowDisconnectRegistration();
    await flushMicrotasks();

    expect(callOrder).toEqual(['onDisconnect', 'remove', 'set']);
  });

  it('publishes the number of connected user entries', () => {
    const service = createService();
    const counts: number[] = [];
    const countSubscription = service.getConnectedUsersCount().subscribe(count => counts.push(count));

    connectedUsers$.next({ visitor_a: true, visitor_b: true, visitor_c: true });
    connectedUsers$.next(null);

    expect(counts).toEqual([0, 3, 0]);
    countSubscription.unsubscribe();
  });

  it('unsubscribes from Firebase and removes its presence entry on destroy', async () => {
    const service = createService();
    const visitorId = sessionStorage.getItem('visitorId');
    let countStreamCompleted = false;
    const countSubscription = service.getConnectedUsersCount().subscribe({
      complete: () => countStreamCompleted = true
    });

    expect(connected$.observers.length).toBe(1);
    expect(connectedUsers$.observers.length).toBe(1);

    destroyService(service);
    await flushMicrotasks();

    expect(connected$.observers.length).toBe(0);
    expect(connectedUsers$.observers.length).toBe(0);
    expect(countStreamCompleted).toBeTrue();
    const removalPath = objectSpy.calls.mostRecent().args[0] as string;
    expect(removalPath).toMatch(new RegExp(`^connectedUsers/${visitorId}_connection_`));
    expect(removePresenceSpy).toHaveBeenCalledTimes(1);

    connected$.next(true);
    expect(refSpy).not.toHaveBeenCalled();
    countSubscription.unsubscribe();
  });

  function createService(): UserService {
    const service = new UserService({
      object: objectSpy,
      database: { ref: refSpy }
    } as any);

    services.push(service);
    return service;
  }

  function destroyService(service: UserService): void {
    service.ngOnDestroy();
    services = services.filter(candidate => candidate !== service);
  }

  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }
});
