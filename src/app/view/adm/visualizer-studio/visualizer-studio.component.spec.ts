import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import Swal from 'sweetalert2';
import { VisualizerCatalogService } from 'src/app/services/visualizer-catalog.service';
import { VisualizerDocument } from 'src/app/services/interfaces/visualizer/visualizer-document';
import { VISUALIZER_PRESETS } from 'src/app/services/visualizer-presets';
import { VISUALIZER_CUSTOMIZATION_DEFAULTS } from 'src/app/services/visualizer-customization';
import { VisualizerStudioComponent } from './visualizer-studio.component';

describe('VisualizerStudioComponent', () => {
  let component: VisualizerStudioComponent;
  let catalog: jasmine.SpyObj<VisualizerCatalogService>;
  let library: Subject<VisualizerDocument[]>;
  let confirmation: jasmine.Spy;

  beforeEach(() => {
    library = new Subject<VisualizerDocument[]>();
    catalog = jasmine.createSpyObj<VisualizerCatalogService>('catalog', [
      'watchAll', 'create', 'update', 'delete'
    ]);
    catalog.watchAll.and.returnValue(library);
    catalog.create.and.resolveTo('new-id');
    catalog.update.and.resolveTo(undefined);
    catalog.delete.and.resolveTo(undefined);
    confirmation = spyOn(Swal, 'fire').and.resolveTo({
      isConfirmed: true, isDenied: false, isDismissed: false
    });
    component = new VisualizerStudioComponent(new FormBuilder(), catalog);
    component.ngOnInit();
  });

  afterEach(() => component.ngOnDestroy());

  it('creates a complete trimmed draft and marks it saved only after Firestore confirmation', async () => {
    fill({ name: '  Aurora  ', description: '  Luz e som.  ', color: '#abcdef', amplitude: 67 });
    const expected = { ...component.form.getRawValue(), name: 'Aurora', description: 'Luz e som.' };

    await component.save();

    expect(catalog.create).toHaveBeenCalledOnceWith(expected);
    expect(catalog.update).not.toHaveBeenCalled();
    expect(expected.enabled).toBeFalse();
    expect(expected.id).toBeUndefined();
    expect(component.editingId).toBe('new-id');
    expect(component.form.pristine).toBeTrue();
    expect(component.form.enabled).toBeTrue();
    expect(component.notice).toContain('Rascunho salvo');
    expect(component.saveError).toBe('');
  });

  it('updates the same newly created id on subsequent saves instead of creating duplicates', async () => {
    fill({ name: 'Aurora' });
    await component.save();
    fill({ amplitude: 82, enabled: true });

    await component.save();

    expect(catalog.create).toHaveBeenCalledTimes(1);
    expect(catalog.update).toHaveBeenCalledOnceWith('new-id', jasmine.objectContaining({
      name: 'Aurora', amplitude: 82, enabled: true
    }));
    expect(component.notice).toContain('publicado no player');
  });

  it('loads an existing record for editing and preserves its id while changing publication', async () => {
    const saved = makeDocument('saved-id', { enabled: true, description: 'Original', glow: 22 });
    await component.edit(saved);

    expect(component.editingId).toBe('saved-id');
    expect(component.previewConfig.id).toBe('saved-id');
    expect(component.form.pristine).toBeTrue();
    expect(component.form.get('glow')?.value).toBe(22);
    fill({ enabled: false, description: 'Revisado' });
    await component.save();

    expect(catalog.update).toHaveBeenCalledOnceWith('saved-id', jasmine.objectContaining({
      enabled: false, description: 'Revisado'
    }));
    expect(catalog.create).not.toHaveBeenCalled();
  });

  it('rejects blank names, invalid colors, out-of-range values and fractional counts before saving', async () => {
    const invalidValues = [
      { name: '   ' }, { name: 'a'.repeat(61) }, { amplitude: -1 }, { amplitude: 101 },
      { audioSensitivity: 0.1 }, { speed: 5.1 }, { opacity: 1.1 }, { phase: -361 },
      { frequency: 0.2 }, { glow: 41 }, { resolution: 769 }, { layers: 1.5 },
      { harmonics: 1.5 }, { barCount: 12.5 }, { color: '#zzzzzz' }
    ];
    for (const values of invalidValues) {
      component.form.reset({ ...VISUALIZER_PRESETS[0], name: 'Válido', description: '', enabled: false });
      fill(values);
      await component.save();
      expect(component.form.invalid).withContext(JSON.stringify(values)).toBeTrue();
      expect(component.saveError).withContext(JSON.stringify(values)).not.toBe('');
    }
    expect(catalog.create).not.toHaveBeenCalled();
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('preserves unsaved edits and allows a retry after a failed write', async () => {
    await component.edit(makeDocument('saved-id'));
    fill({ name: 'Minha alteração', color: '#38bdf8', enabled: true });
    catalog.update.and.rejectWith(new Error('permission-denied'));

    await component.save();

    expect(component.form.dirty).toBeTrue();
    expect(component.form.enabled).toBeTrue();
    expect(component.form.get('name')?.value).toBe('Minha alteração');
    expect(component.form.get('color')?.value).toBe('#38bdf8');
    expect(component.editingId).toBe('saved-id');
    expect(component.saving).toBeFalse();
    expect(component.notice).toBe('');
    expect(component.saveError).not.toBe('');

    catalog.update.and.resolveTo(undefined);
    await component.save();
    expect(component.form.pristine).toBeTrue();
    expect(component.saveError).toBe('');
    expect(catalog.update).toHaveBeenCalledTimes(2);
  });

  it('keeps the custom color editor available while its hex value is cleared or partially typed', async () => {
    fill({ name: 'Aurora' });
    for (const key of ['color', 'secondaryColor']) {
      for (const value of ['', '#', 'abc', '#12a']) {
        component.form.get(key)?.setValue(value);
        expect(component.colorMode(key)).withContext(`${key}: ${value}`).toBe('custom');
      }
      component.form.get(key)?.setValue('');
      expect(component.form.get(key)?.invalid).toBeTrue();
      await component.save();
      expect(catalog.create).not.toHaveBeenCalled();
      component.form.get(key)?.setValue('#12abef');
      expect(component.form.get(key)?.valid).toBeTrue();
      expect(component.colorMode(key)).toBe('custom');
      component.form.get(key)?.setValue('theme');
      expect(component.colorMode(key)).toBe('theme');
    }
  });

  it('keeps a failed creation as a new draft so retry uses create', async () => {
    fill({ name: 'Nova atmosfera' });
    catalog.create.and.rejectWith(new Error('unavailable'));
    await component.save();

    expect(component.editingId).toBeNull();
    expect(component.form.dirty).toBeTrue();
    expect(component.notice).toBe('');

    catalog.create.and.resolveTo('retried-id');
    await component.save();
    expect(component.editingId).toBe('retried-id');
    expect(catalog.create).toHaveBeenCalledTimes(2);
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('waits for pending writes and prevents duplicate submits or navigation while saving', async () => {
    let complete!: (id: string) => void;
    catalog.create.and.returnValue(new Promise<string>(resolve => { complete = resolve; }));
    fill({ name: 'Pendente' });

    const pending = component.save();
    expect(component.saving).toBeTrue();
    expect(component.form.disabled).toBeTrue();
    expect(component.form.dirty).toBeTrue();
    expect(component.notice).toBe('');
    expect(await component.confirmDiscard()).toBeFalse();
    await component.save();
    expect(catalog.create).toHaveBeenCalledTimes(1);

    complete('confirmed-id');
    await pending;
    expect(component.editingId).toBe('confirmed-id');
    expect(component.saving).toBeFalse();
    expect(component.form.enabled).toBeTrue();
  });

  it('changes the rendering template without replacing identity or publication settings', () => {
    fill({ name: 'Meu visual', description: 'Minha descrição', enabled: true });
    component.applyTemplate(VISUALIZER_PRESETS[1]);

    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({
      name: 'Meu visual', description: 'Minha descrição', enabled: true,
      geometry: 'bars', visualStyle: 'bars', barCount: VISUALIZER_PRESETS[1].barCount
    }));
    expect(component.previewConfig.visualStyle).toBe('bars');
    expect(component.form.dirty).toBeTrue();
    expect(catalog.create).not.toHaveBeenCalled();
  });

  it('updates preview colors immediately without writing before save', () => {
    component.applyPalette(['#fb7185', '#fbbf24']);

    expect(component.previewConfig.color).toBe('#fb7185');
    expect(component.previewConfig.secondaryColor).toBe('#fbbf24');
    expect(component.form.dirty).toBeTrue();
    expect(catalog.create).not.toHaveBeenCalled();
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('duplicates a published record as a new unsaved draft with a bounded name', async () => {
    const original = makeDocument('original-id', { name: 'a'.repeat(60), enabled: true, glow: 28 });
    await component.duplicate(original);

    expect(component.editingId).toBeNull();
    expect(component.form.get('enabled')?.value).toBeFalse();
    expect(component.form.get('name')?.value.length).toBeLessThanOrEqual(60);
    expect(component.form.get('name')?.value).toContain('cópia');
    expect(component.form.get('glow')?.value).toBe(28);
    expect(component.form.dirty).toBeTrue();
    expect(catalog.create).not.toHaveBeenCalled();
    expect(original.enabled).toBeTrue();
    await component.save();
    expect(catalog.create).toHaveBeenCalledTimes(1);
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('keeps the current draft when discarding edits is cancelled', async () => {
    fill({ name: 'Manter esta ideia', amplitude: 79 });
    confirmation.and.resolveTo({ isConfirmed: false, isDenied: false, isDismissed: true });

    await component.newVisualizer();
    await component.edit(makeDocument('another-id'));

    expect(component.form.get('name')?.value).toBe('Manter esta ideia');
    expect(component.form.get('amplitude')?.value).toBe(79);
    expect(component.form.dirty).toBeTrue();
    expect(component.editingId).toBeNull();
  });

  it('starts a clean unpublished creation after the user confirms discarding changes', async () => {
    await component.edit(makeDocument('saved-id', { enabled: true }));
    fill({ name: 'Alteração não salva' });

    await component.newVisualizer();

    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(component.editingId).toBeNull();
    expect(component.form.get('name')?.value).toBe('');
    expect(component.form.get('enabled')?.value).toBeFalse();
    expect(component.form.pristine).toBeTrue();
    expect(component.activeTab).toBe('identity');
  });

  it('does not delete when confirmation is cancelled', async () => {
    confirmation.and.resolveTo({ isConfirmed: false, isDenied: false, isDismissed: true });

    await component.remove(makeDocument('saved-id'));

    expect(catalog.delete).not.toHaveBeenCalled();
    expect(component.deletingId).toBeNull();
  });

  it('retains the editor after a failed delete and resets it after a confirmed successful deletion', async () => {
    const saved = makeDocument('saved-id');
    await component.edit(saved);
    catalog.delete.and.rejectWith(new Error('unavailable'));
    await component.remove(saved);

    expect(component.editingId).toBe('saved-id');
    expect(component.form.get('name')?.value).toBe(saved.name);
    expect(component.saveError).not.toBe('');
    expect(component.deletingId).toBeNull();

    catalog.delete.and.resolveTo(undefined);
    await component.remove(saved);
    expect(component.editingId).toBeNull();
    expect(component.form.get('name')?.value).toBe('');
    expect(component.form.pristine).toBeTrue();
    expect(component.notice).toContain('excluído');
  });

  it('combines publication filters with case-insensitive name and description search', () => {
    library.next([
      makeDocument('published', { name: 'Aurora', enabled: true, description: 'Luzes do norte' }),
      makeDocument('draft', { name: 'Noite', enabled: false, description: 'Minha aurora' }),
      makeDocument('other', { name: 'Oceano', enabled: true })
    ]);
    component.search = ' AURORA ';
    component.filter = 'published';
    expect(component.filteredDocuments.map(item => item.id)).toEqual(['published']);
    component.filter = 'draft';
    expect(component.filteredDocuments.map(item => item.id)).toEqual(['draft']);
    expect(component.publishedCount).toBe(2);
    expect(component.documents.length).toBe(3);
    expect(component.loading).toBeFalse();
  });

  it('surfaces a failed catalog read and reconnects when retry is requested', () => {
    library.error(new Error('permission-denied'));
    expect(component.loading).toBeFalse();
    expect(component.loadError).not.toBe('');

    library = new Subject<VisualizerDocument[]>();
    catalog.watchAll.and.returnValue(library);
    component.loadLibrary();
    expect(component.loading).toBeTrue();
    expect(component.loadError).toBe('');
    library.next([makeDocument('reloaded')]);
    expect(component.documents[0].id).toBe('reloaded');
    expect(component.loading).toBeFalse();
  });

  it('warns on closing the page while changes are dirty or a save is pending', () => {
    const cleanEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.beforeUnload(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBeFalse();
    fill({ name: 'Não salvo' });
    const dirtyEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.beforeUnload(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBeTrue();
    component.form.markAsPristine();
    component.saving = true;
    const savingEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.beforeUnload(savingEvent);
    expect(savingEvent.defaultPrevented).toBeTrue();
  });

  it('only offers relevant controls for the selected style and tab', () => {
    component.applyTemplate(VISUALIZER_PRESETS[1]);
    component.activeTab = 'motion';
    expect(component.visibleControls.map(control => control.key)).toContain('barCount');
    expect(component.visibleControls.map(control => control.key)).not.toContain('frequency');
    component.activeTab = 'finish';
    expect(component.visibleControls.map(control => control.key)).toContain('opacity');
    expect(component.visibleControls.map(control => control.key)).not.toContain('resolution');
    component.applyTemplate(VISUALIZER_PRESETS[2]);
    expect(component.visibleControls.map(control => control.key)).toEqual(['opacity', 'particleCount', 'particleSize']);
    component.activeTab = 'composition';
    expect(component.visibleControls.map(control => control.key)).toEqual(['scale', 'positionX', 'positionY', 'angle', 'particleSpread']);
  });

  it('saves and restores the new appearance, composition and particle controls without losing identity', async () => {
    const customization = {
      scale: 0.75, positionX: -10, positionY: 15, angle: -25, mirrorX: true,
      colorMode: 'gradient', waveShape: 'triangle', barLayout: 'center', barGap: 0.6,
      particleCount: 64, particleSize: 2, particleSpread: 0.75, twinkleSpeed: 1.5, veilOpacity: 0.4
    };
    fill({ name: 'Meu jardim', enabled: true, ...customization });
    component.setIcon('auto_awesome');
    await component.save();
    expect(catalog.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      name: 'Meu jardim', enabled: true, icon: 'auto_awesome', ...customization
    }));
    const saved = catalog.create.calls.mostRecent().args[0];
    await component.edit({ ...saved, id: 'loaded' });
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining(customization));
    expect(component.previewConfig).toEqual(jasmine.objectContaining(customization));
    expect(component.form.pristine).toBeTrue();
  });

  it('restores neutral composition while retaining colors, movement and publication', () => {
    fill({ name: 'Preservar', enabled: true, color: '#112233', speed: 0.9,
      scale: 1.8, positionX: 35, positionY: -22, angle: 90, mirrorX: true, particleSpread: 0.4 });
    component.resetComposition();
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({
      name: 'Preservar', enabled: true, color: '#112233', speed: 0.9,
      scale: 1, positionX: 0, positionY: 0, angle: 0, mirrorX: false, particleSpread: 1
    }));
    expect(component.form.dirty).toBeTrue();
    expect(catalog.create).not.toHaveBeenCalled();
  });

  it('creates valid variations for each style without saving or changing document identity', async () => {
    spyOn(Math, 'random').and.returnValue(0.7);
    await component.edit(makeDocument('original', { name: 'Nome preservado', description: 'Descrição', enabled: true }));
    for (const template of VISUALIZER_PRESETS) {
      component.applyTemplate(template);
      component.setIcon('auto_awesome');
      component.createVariation();
      expect(component.form.valid).withContext(template.visualStyle).toBeTrue();
      expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({
        name: 'Nome preservado', description: 'Descrição', enabled: true, icon: 'auto_awesome',
        geometry: template.geometry, visualStyle: template.visualStyle
      }));
      expect(component.editingId).toBe('original');
      expect(component.form.dirty).toBeTrue();
    }
    expect(catalog.create).not.toHaveBeenCalled();
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('opens legacy documents with complete neutral customization defaults', async () => {
    const legacy = makeDocument('legacy') as any;
    for (const key of Object.keys(VISUALIZER_CUSTOMIZATION_DEFAULTS)) delete legacy[key];
    await component.edit(legacy);
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining(VISUALIZER_CUSTOMIZATION_DEFAULTS));
    expect(component.form.valid).toBeTrue();
    expect(component.form.pristine).toBeTrue();
  });

  it('blocks invalid new control values before sending writes', async () => {
    const invalidValues = [ { scale: 0 }, { positionX: 51 }, { positionY: -51 }, { angle: 181 },
      { barGap: 1 }, { particleCount: 97 }, { particleCount: 4.5 }, { particleSize: 0.2 },
      { particleSpread: 2 }, { twinkleSpeed: 0 }, { veilOpacity: 2 }, { colorMode: 'wrong' },
      { waveShape: 'wrong' }, { barLayout: 'wrong' } ];
    for (const value of invalidValues) {
      await component.edit(makeDocument('validation'));
      fill(value);
      await component.save();
      expect(component.form.invalid).withContext(JSON.stringify(value)).toBeTrue();
    }
    expect(catalog.create).not.toHaveBeenCalled();
    expect(catalog.update).not.toHaveBeenCalled();
  });

  it('cleans up subscriptions when leaving the admin', () => {
    expect(library.observers.length).toBe(1);
    component.loadLibrary();
    expect(library.observers.length).toBe(1);
    component.ngOnDestroy();
    expect(library.observers.length).toBe(0);
  });

  function fill(values: object): void {
    component.form.patchValue(values);
    component.form.markAsDirty();
  }

  function makeDocument(id: string, overrides: Partial<VisualizerDocument> = {}): VisualizerDocument {
    return { ...VISUALIZER_PRESETS[0], id, description: '', enabled: false, ...overrides };
  }
});
