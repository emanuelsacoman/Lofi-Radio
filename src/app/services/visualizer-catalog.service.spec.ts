import { TestBed } from '@angular/core/testing';
import { ɵAngularFireSchedulers } from '@angular/fire';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { serverTimestamp } from '@angular/fire/firestore';
import { firstValueFrom, of, throwError } from 'rxjs';
import { VisualizerDraft } from './interfaces/visualizer/visualizer-document';
import { VISUALIZER_PRESETS } from './visualizer-presets';
import { VisualizerCatalogService } from './visualizer-catalog.service';
import { VISUALIZER_CUSTOMIZATION_DEFAULTS } from './visualizer-customization';

describe('VisualizerCatalogService', () => {
  let service: VisualizerCatalogService;
  let collection: jasmine.Spy;
  let add: jasmine.Spy;
  let doc: jasmine.Spy;
  let update: jasmine.Spy;
  let remove: jasmine.Spy;
  let snapshotChanges: jasmine.Spy;
  let where: jasmine.Spy;

  beforeEach(() => {
    // The timestamp factory must come from the same SDK as AngularFirestore.
    TestBed.inject(ɵAngularFireSchedulers);
    add = jasmine.createSpy('add').and.resolveTo({ id: 'generated-id' });
    update = jasmine.createSpy('update').and.resolveTo(undefined);
    remove = jasmine.createSpy('delete').and.resolveTo(undefined);
    doc = jasmine.createSpy('doc').and.returnValue({ update, delete: remove });
    snapshotChanges = jasmine.createSpy('snapshotChanges').and.returnValue(of([]));
    where = jasmine.createSpy('where').and.returnValue({});
    collection = jasmine.createSpy('collection').and.callFake(
      (_path: string, query?: (ref: unknown) => unknown) => {
        query?.({ where });
        return { add, doc, snapshotChanges };
      }
    );
    service = new VisualizerCatalogService({ collection } as unknown as AngularFirestore);
  });

  it('persists the complete draft with generated identity and server timestamps', async () => {
    const draft = {
      ...makeDraft(), name: '  Aurora  ', description: '  Luz e música.  ',
      id: 'untrusted-id', createdAt: 'client-time', unrelated: 'form state'
    };

    const id = await service.create(draft);

    expect(id).toBe('generated-id');
    expect(collection).toHaveBeenCalledOnceWith('visualizers');
    expect(add).toHaveBeenCalledOnceWith({
      ...makeDraft(), name: 'Aurora', description: 'Luz e música.',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
  });

  it('updates the same document without changing its creation timestamp', async () => {
    await service.update(' saved-id ', { ...makeDraft(), enabled: true });

    expect(doc).toHaveBeenCalledOnceWith('saved-id');
    expect(update).toHaveBeenCalledOnceWith({
      ...makeDraft(), enabled: true, updatedAt: serverTimestamp()
    });
    expect(add).not.toHaveBeenCalled();
  });

  it('round-trips every custom composition, color and style parameter', async () => {
    const draft: VisualizerDraft = {
      ...makeDraft(), scale: 1.65, positionX: -21, positionY: 18, angle: 42,
      mirrorX: true, colorMode: 'gradient', waveShape: 'triangle',
      barLayout: 'center', barGap: 0.6, particleCount: 64,
      particleSize: 2.25, particleSpread: 0.75, twinkleSpeed: 1.8, veilOpacity: 0.35
    };
    await service.create(draft);
    expect(add).toHaveBeenCalledOnceWith({
      ...draft, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });

    snapshotChanges.and.returnValue(of([change('saved', draft)]));
    const documents = await firstValueFrom(service.watchAll());
    const { id, createdAt, updatedAt, ...restored } = documents[0];
    expect(id).toBe('saved');
    expect(restored).toEqual(draft);
  });

  it('reads legacy documents with defaults and persists them on the next edit', async () => {
    const legacy = makeDraft();
    for (const key of Object.keys(VISUALIZER_CUSTOMIZATION_DEFAULTS) as Array<keyof typeof VISUALIZER_CUSTOMIZATION_DEFAULTS>) {
      delete legacy[key];
    }
    snapshotChanges.and.returnValue(of([change('legacy', legacy)]));
    const documents = await firstValueFrom(service.watchAll());
    expect(documents[0]).toEqual(jasmine.objectContaining({
      ...legacy, ...VISUALIZER_CUSTOMIZATION_DEFAULTS, id: 'legacy'
    }));

    await service.update('legacy', legacy);
    expect(update).toHaveBeenCalledOnceWith({
      ...legacy, ...VISUALIZER_CUSTOMIZATION_DEFAULTS, updatedAt: serverTimestamp()
    });
  });

  it('rejects malformed customization instead of silently replacing it with defaults', async () => {
    const invalid = [
      { scale: 0 }, { scale: Infinity }, { positionX: 51 }, { positionY: -51 },
      { angle: 181 }, { mirrorX: 'true' }, { colorMode: 'rainbow' },
      { waveShape: 'square' }, { barLayout: 'radial' }, { barGap: 1 },
      { particleCount: 97 }, { particleCount: 4.5 }, { particleSize: 0 },
      { particleSpread: 2 }, { twinkleSpeed: 0 }, { veilOpacity: -1 }, { scale: null }
    ];
    for (const patch of invalid) {
      await expectAsync(service.create({ ...makeDraft(), ...patch } as VisualizerDraft))
        .withContext(JSON.stringify(patch)).toBeRejectedWithError();
    }
    expect(collection).not.toHaveBeenCalled();

    snapshotChanges.and.returnValue(of([
      change('invalid-new-fields', { ...makeDraft(), particleCount: 'many' }),
      change('valid', makeDraft())
    ]));
    expect((await firstValueFrom(service.watchAll())).map(item => item.id)).toEqual(['valid']);
  });

  it('keeps failed writes rejected so the editor cannot report a successful save', async () => {
    const denied = new Error('permission-denied');
    add.and.rejectWith(denied);
    update.and.rejectWith(denied);

    await expectAsync(service.create(makeDraft())).toBeRejectedWith(denied);
    await expectAsync(service.update('saved-id', makeDraft())).toBeRejectedWith(denied);
  });

  it('rejects invalid configurations before contacting Firestore', async () => {
    const invalidDrafts: VisualizerDraft[] = [
      { ...makeDraft(), name: '   ' },
      { ...makeDraft(), name: 'a'.repeat(61) },
      { ...makeDraft(), description: 'a'.repeat(281) },
      { ...makeDraft(), amplitude: NaN },
      { ...makeDraft(), speed: Infinity },
      { ...makeDraft(), audioSensitivity: 0 },
      { ...makeDraft(), layers: 1.5 },
      { ...makeDraft(), resolution: 769 },
      { ...makeDraft(), geometry: 'bars', visualStyle: 'silk' },
      { ...makeDraft(), geometry: 'wave', visualStyle: 'bars' },
      { ...makeDraft(), geometry: 'bars', visualStyle: 'fireflies' },
      { ...makeDraft(), color: 'url(https://example.com/image)' },
      { ...makeDraft(), icon: '<svg>' }
    ];
    for (const draft of invalidDrafts) {
      await expectAsync(service.create(draft)).toBeRejectedWithError();
    }
    expect(collection).not.toHaveBeenCalled();
  });

  it('rejects invalid document paths before update or delete', async () => {
    for (const id of ['', '   ', 'parent/child', '.', '..', ' . ']) {
      await expectAsync(service.update(id, makeDraft())).toBeRejectedWithError();
      await expectAsync(service.delete(id)).toBeRejectedWithError();
    }
    expect(collection).not.toHaveBeenCalled();
  });

  it('reads published creations using the query required by security rules', async () => {
    await firstValueFrom(service.watchPublished());

    expect(collection).toHaveBeenCalledWith('visualizers', jasmine.any(Function));
    expect(where).toHaveBeenCalledOnceWith('enabled', '==', true);
  });

  it('keeps drafts in the admin catalog and uses real document ids with stable name ordering', async () => {
    snapshotChanges.and.returnValue(of([
      change('z-id', { ...makeDraft(), name: 'Zen', enabled: true }),
      change('a-id', { ...makeDraft(), name: 'Aurora', id: 'spoofed' })
    ]));

    const documents = await firstValueFrom(service.watchAll());

    expect(documents.map(item => item.id)).toEqual(['a-id', 'z-id']);
    expect(documents[0].enabled).toBeFalse();
    expect(where).not.toHaveBeenCalled();
  });

  it('ignores malformed records instead of feeding invalid values to the renderer', async () => {
    snapshotChanges.and.returnValue(of([
      change('broken', { ...makeDraft(), amplitude: 'not a number' }),
      change('valid', makeDraft())
    ]));

    const documents = await firstValueFrom(service.watchAll());

    expect(documents.map(item => item.id)).toEqual(['valid']);
  });

  it('propagates read failures so the admin can offer a retry', async () => {
    const denied = new Error('permission-denied');
    snapshotChanges.and.returnValue(throwError(() => denied));

    await expectAsync(firstValueFrom(service.watchAll())).toBeRejectedWith(denied);
  });

  it('deletes the selected saved record and propagates deletion failure', async () => {
    await service.delete('saved-id');
    expect(doc).toHaveBeenCalledOnceWith('saved-id');
    expect(remove).toHaveBeenCalledTimes(1);

    const denied = new Error('permission-denied');
    remove.and.rejectWith(denied);
    await expectAsync(service.delete('saved-id')).toBeRejectedWith(denied);
  });

  function makeDraft(): VisualizerDraft {
    const { id: _id, ...config } = VISUALIZER_PRESETS[0];
    return { ...config, description: '', enabled: false };
  }

  function change(id: string, data: object): object {
    return { payload: { doc: { id, data: () => data } } };
  }
});
