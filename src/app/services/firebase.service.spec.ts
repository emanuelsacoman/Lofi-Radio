import { AngularFirestore } from '@angular/fire/compat/firestore';
import { of } from 'rxjs';

import { FirebaseService } from './firebase.service';
import { Chip } from './interfaces/chip';

type LooseMock = Record<string, any>;

describe('FirebaseService', () => {
  describe('obterTodosChip', () => {
    it('observes the complete collection so legacy radios without order remain visible', () => {
      const changes$ = of([]);
      const collection = {
        snapshotChanges: jasmine.createSpy('snapshotChanges').and.returnValue(changes$)
      };
      const { service, collectionSpy } = createHarness(collection);

      const result = service.obterTodosChip();

      expect(result).toBe(changes$);
      expect(collectionSpy).toHaveBeenCalledOnceWith('radios');
      expect(collection.snapshotChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe('cadastrarChip', () => {
    it('normalizes the video id and creates a stable document inside a transaction', async () => {
      const highestOrderGet = jasmine.createSpy('highestOrderGet').and.resolveTo(
        querySnapshot([queryDocument('last-radio', { order: 7 })])
      );
      const legacyDuplicateGet = jasmine.createSpy('legacyDuplicateGet').and.resolveTo(
        querySnapshot([])
      );
      const orderQuery = {
        name: 'highest-order-query',
        get: highestOrderGet
      };
      const duplicateQuery = {
        name: 'legacy-duplicate-query',
        get: legacyDuplicateGet
      };
      const orderLimit = jasmine.createSpy('orderLimit').and.returnValue(orderQuery);
      const duplicateLimit = jasmine.createSpy('duplicateLimit').and.returnValue(duplicateQuery);
      const collectionRef = {
        orderBy: jasmine.createSpy('orderBy').and.returnValue({ limit: orderLimit }),
        where: jasmine.createSpy('where').and.returnValue({ limit: duplicateLimit })
      };
      const stableRef = { id: 'video-42', path: 'radios/video-42' };
      const document = {
        ref: stableRef
      };
      const collection = {
        ref: collectionRef,
        doc: jasmine.createSpy('doc').and.returnValue(document)
      };
      const transaction = {
        get: jasmine.createSpy('transaction.get').and.resolveTo({ exists: false }),
        set: jasmine.createSpy('transaction.set')
      };
      const runTransaction = jasmine.createSpy('runTransaction').and.callFake(
        async (operation: (currentTransaction: LooseMock) => Promise<unknown>) => {
          expect(highestOrderGet).toHaveBeenCalledTimes(1);
          expect(legacyDuplicateGet).toHaveBeenCalledTimes(1);
          return operation(transaction);
        }
      );
      const { service } = createHarness(collection, collectionRef, {
        runTransaction
      });

      const result = await service.cadastrarChip(new Chip('', '  video-42  '));

      expect(collectionRef.orderBy).toHaveBeenCalledOnceWith('order', 'desc');
      expect(orderLimit).toHaveBeenCalledOnceWith(1);
      expect(collectionRef.where).toHaveBeenCalledOnceWith(
        'chipname',
        '==',
        'video-42'
      );
      expect(duplicateLimit).toHaveBeenCalledOnceWith(1);
      expect(highestOrderGet).toHaveBeenCalledTimes(1);
      expect(legacyDuplicateGet).toHaveBeenCalledTimes(1);
      expect(collection.doc).toHaveBeenCalledOnceWith('video-42');
      expect(runTransaction).toHaveBeenCalledTimes(1);
      expect(transaction.get).toHaveBeenCalledOnceWith(stableRef);
      expect(transaction.set).toHaveBeenCalledOnceWith(stableRef, {
        chipname: 'video-42',
        order: 8
      });
      expect(result as unknown).toBe(stableRef);
    });

    it('rejects a blank video id before accessing Firestore', async () => {
      const collection = jasmine.createSpyObj('collection', ['doc']);
      const { service, collectionSpy, runTransaction } = createHarness(collection);

      await expectAsync(
        service.cadastrarChip(new Chip('', '   '))
      ).toBeRejectedWithError('Video ID is required');

      expect(collectionSpy).not.toHaveBeenCalled();
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('rejects a legacy duplicate before opening the transaction', async () => {
      const stableRef = { id: 'video-42', path: 'radios/video-42' };
      const highestOrderGet = jasmine.createSpy('highestOrderGet').and.resolveTo(
        querySnapshot([queryDocument('last-radio', { order: 3 })])
      );
      const legacyDuplicateGet = jasmine.createSpy('legacyDuplicateGet').and.resolveTo(
        querySnapshot([queryDocument('legacy-doc', { chipname: 'video-42', order: 2 })])
      );
      const collectionRef = {
        orderBy: jasmine.createSpy('orderBy').and.returnValue({
          limit: jasmine.createSpy('orderLimit').and.returnValue({ get: highestOrderGet })
        }),
        where: jasmine.createSpy('where').and.returnValue({
          limit: jasmine.createSpy('duplicateLimit').and.returnValue({
            get: legacyDuplicateGet
          })
        })
      };
      const collection = {
        ref: collectionRef,
        doc: jasmine.createSpy('doc').and.returnValue({ ref: stableRef })
      };
      const { service, runTransaction } = createHarness(collection, collectionRef);

      await expectAsync(
        service.cadastrarChip(new Chip('', '  video-42 '))
      ).toBeRejectedWithError('Radio already exists');

      expect(collection.doc).toHaveBeenCalledOnceWith('video-42');
      expect(highestOrderGet).toHaveBeenCalledTimes(1);
      expect(legacyDuplicateGet).toHaveBeenCalledTimes(1);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('rejects a concurrent duplicate found at the stable document id', async () => {
      const stableRef = { id: 'video-42', path: 'radios/video-42' };
      const collectionRef = {
        orderBy: jasmine.createSpy('orderBy').and.returnValue({
          limit: () => ({
            get: () => Promise.resolve(querySnapshot([]))
          })
        }),
        where: jasmine.createSpy('where').and.returnValue({
          limit: () => ({
            get: () => Promise.resolve(querySnapshot([]))
          })
        })
      };
      const collection = {
        ref: collectionRef,
        doc: jasmine.createSpy('doc').and.returnValue({ ref: stableRef })
      };
      const transaction = {
        get: jasmine.createSpy('transaction.get').and.resolveTo({ exists: true }),
        set: jasmine.createSpy('transaction.set')
      };
      const runTransaction = jasmine.createSpy('runTransaction').and.callFake(
        async (operation: (currentTransaction: LooseMock) => Promise<unknown>) =>
          operation(transaction)
      );
      const { service } = createHarness(collection, collectionRef, {
        runTransaction
      });

      await expectAsync(
        service.cadastrarChip(new Chip('', 'video-42'))
      ).toBeRejectedWithError('Radio already exists');

      expect(runTransaction).toHaveBeenCalledTimes(1);
      expect(transaction.get).toHaveBeenCalledOnceWith(stableRef);
      expect(transaction.set).not.toHaveBeenCalled();
    });
  });

  describe('excluirChip', () => {
    it('deletes the document and compacts following positions in one batch', async () => {
      const deletedRef = { id: 'station-b', path: 'radios/station-b' };
      const followingRefOne = { id: 'station-c', path: 'radios/station-c' };
      const followingRefTwo = { id: 'station-d', path: 'radios/station-d' };
      const deletedDocument = {
        exists: true,
        data: () => ({ chipname: 'station-b', order: 2 })
      };
      const getDeleted = jasmine.createSpy('getDeleted').and.returnValue({
        toPromise: () => Promise.resolve(deletedDocument)
      });
      const document = {
        ref: deletedRef,
        get: getDeleted,
        delete: jasmine.createSpy('directDelete')
      };
      const following = querySnapshot([
        queryDocument('station-c', { order: 3 }, followingRefOne),
        queryDocument('station-d', { order: 4 }, followingRefTwo)
      ]);
      const followingGet = jasmine.createSpy('followingGet').and.resolveTo(following);
      const collectionRef = {
        where: jasmine.createSpy('where').and.returnValue({ get: followingGet })
      };
      const collection = {
        ref: collectionRef,
        doc: jasmine.createSpy('doc').and.returnValue(document)
      };
      const batch = createBatch();
      const { service, batchFactory } = createHarness(collection, collectionRef, {}, batch);

      await service.excluirChip('station-b');

      expect(collection.doc).toHaveBeenCalledWith('station-b');
      expect(collectionRef.where).toHaveBeenCalledOnceWith('order', '>', 2);
      expect(batchFactory).toHaveBeenCalledTimes(1);
      expect(batch['delete']).toHaveBeenCalledOnceWith(deletedRef);
      expect(batch['update'].calls.allArgs()).toEqual([
        [followingRefOne, { order: 2 }],
        [followingRefTwo, { order: 3 }]
      ]);
      expect(batch['commit']).toHaveBeenCalledTimes(1);
      expect(document.delete).not.toHaveBeenCalled();
    });
  });

  describe('cadastrarChipsEmLote', () => {
    it('normalizes and deduplicates ids while preserving stable document ids', async () => {
      const snapshot = querySnapshot([
        queryDocument('existing-radio', { chipname: 'existing-radio', order: 4 })
      ]);
      const collectionRef = {
        get: jasmine.createSpy('get').and.resolveTo(snapshot)
      };
      const refs = new Map<string, LooseMock>();
      const collection = {
        ref: collectionRef,
        doc: jasmine.createSpy('doc').and.callFake((id: string) => {
          const ref = { id, path: `radios/${id}` };
          refs.set(id, ref);
          return { ref };
        })
      };
      const batch = createBatch();
      const { service } = createHarness(collection, collectionRef, {}, batch);

      const created = await service.cadastrarChipsEmLote([
        ' new-radio ',
        'new-radio',
        '',
        '   ',
        'existing-radio',
        ' another-radio '
      ]);

      expect(created).toBe(2);
      expect(collection.doc.calls.allArgs()).toEqual([
        ['new-radio'],
        ['another-radio']
      ]);
      expect(batch['set'].calls.allArgs()).toEqual([
        [refs.get('new-radio'), { chipname: 'new-radio', order: 5 }],
        [refs.get('another-radio'), { chipname: 'another-radio', order: 6 }]
      ]);
      expect(batch['commit']).toHaveBeenCalledTimes(1);
    });
  });

  describe('atualizarOrdemChips', () => {
    it('normalizes duplicate ids and assigns each document one contiguous position', async () => {
      const refs = new Map<string, LooseMock>();
      const collection = {
        doc: jasmine.createSpy('doc').and.callFake((id: string) => {
          const ref = { id, path: `radios/${id}` };
          refs.set(id, ref);
          return { ref };
        })
      };
      const batch = createBatch();
      const { service } = createHarness(collection, {}, {}, batch);

      await service.atualizarOrdemChips([
        ' station-b ',
        'station-a',
        'station-b',
        '',
        ' station-c '
      ]);

      expect(collection.doc.calls.allArgs()).toEqual([
        ['station-b'],
        ['station-a'],
        ['station-c']
      ]);
      expect(batch['update'].calls.allArgs()).toEqual([
        [refs.get('station-b'), { order: 1 }],
        [refs.get('station-a'), { order: 2 }],
        [refs.get('station-c'), { order: 3 }]
      ]);
      expect(batch['commit']).toHaveBeenCalledTimes(1);
    });
  });

  function createHarness(
    collection: LooseMock,
    queryRoot: LooseMock = {},
    nativeOverrides: LooseMock = {},
    batch: LooseMock = createBatch()
  ): {
    service: FirebaseService;
    collectionSpy: jasmine.Spy;
    batchFactory: jasmine.Spy;
    runTransaction: jasmine.Spy;
  } {
    const collectionSpy = jasmine.createSpy('collection').and.callFake(
      (
        _path: string,
        query?: (reference: LooseMock) => LooseMock
      ): LooseMock => {
        if (query) {
          query(queryRoot);
        }

        return collection;
      }
    );
    const batchFactory = jasmine.createSpy('batch').and.returnValue(batch);
    const runTransaction = nativeOverrides['runTransaction'] ||
      jasmine.createSpy('runTransaction');
    const firestore = {
      collection: collectionSpy,
      firestore: {
        batch: batchFactory,
        runTransaction,
        ...nativeOverrides
      }
    } as unknown as AngularFirestore;

    return {
      service: new FirebaseService(firestore),
      collectionSpy,
      batchFactory,
      runTransaction
    };
  }

  function createBatch(): LooseMock {
    return {
      delete: jasmine.createSpy('batch.delete'),
      update: jasmine.createSpy('batch.update'),
      set: jasmine.createSpy('batch.set'),
      commit: jasmine.createSpy('batch.commit').and.resolveTo(undefined)
    };
  }

  function queryDocument(
    id: string,
    data: LooseMock,
    ref: LooseMock = { id, path: `radios/${id}` }
  ): LooseMock {
    return {
      id,
      ref,
      data: () => data
    };
  }

  function querySnapshot(documents: LooseMock[]): LooseMock {
    return {
      docs: documents,
      empty: documents.length === 0,
      size: documents.length,
      forEach: (visitor: (document: LooseMock) => void): void => {
        documents.forEach(visitor);
      }
    };
  }
});
