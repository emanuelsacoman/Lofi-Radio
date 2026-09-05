import { Subject } from 'rxjs';

import { UserService } from './user.service';

describe('UserService online count', () => {
  let onlineCount$: Subject<number | null>;
  let objectSpy: jasmine.Spy;
  let service: UserService;

  beforeEach(() => {
    onlineCount$ = new Subject<number | null>();
    objectSpy = jasmine.createSpy('object').and.callFake((path: string) => {
      if (path !== 'analyticsPublic/onlineCount') {
        throw new Error(`Unexpected database path: ${path}`);
      }

      return { valueChanges: () => onlineCount$.asObservable() };
    });

    service = new UserService({ object: objectSpy } as any);
  });

  afterEach(() => service.ngOnDestroy());

  it('reads the materialized public counter instead of the full presence tree', () => {
    const counts: number[] = [];
    const subscription = service.getConnectedUsersCount().subscribe(count => counts.push(count));

    onlineCount$.next(4);
    onlineCount$.next(null);

    expect(objectSpy).toHaveBeenCalledOnceWith('analyticsPublic/onlineCount');
    expect(counts).toEqual([0, 4, 0]);
    subscription.unsubscribe();
  });

  it('normalizes invalid and negative counters', () => {
    const counts: number[] = [];
    const subscription = service.getConnectedUsersCount().subscribe(count => counts.push(count));

    onlineCount$.next(-3);
    onlineCount$.next(Number.NaN);

    expect(counts).toEqual([0, 0, 0]);
    subscription.unsubscribe();
  });

  it('unsubscribes from Firebase and completes consumers on destroy', () => {
    let completed = false;
    const subscription = service.getConnectedUsersCount().subscribe({
      complete: () => completed = true
    });

    expect(onlineCount$.observers.length).toBe(1);
    service.ngOnDestroy();

    expect(onlineCount$.observers.length).toBe(0);
    expect(completed).toBeTrue();
    subscription.unsubscribe();
  });
});
