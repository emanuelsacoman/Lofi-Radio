import { TestBed } from '@angular/core/testing';

import { VisualizerService } from './visualizer.service';
import { Subject } from 'rxjs';
import { VISUALIZER_PRESETS } from './visualizer-presets';
import { VisualizerCatalogService } from './visualizer-catalog.service';
import { VisualizerDocument } from './interfaces/visualizer/visualizer-document';

describe('VisualizerService', () => {
  let service: VisualizerService;

  function catalogFrom(updates: Subject<VisualizerDocument[]>): VisualizerCatalogService {
    const catalog = jasmine.createSpyObj<VisualizerCatalogService>('catalog', ['watchPublished']);
    catalog.watchPublished.and.returnValue(updates);
    return catalog;
  }

  beforeEach(() => {
<<<<<<< Updated upstream
    TestBed.configureTestingModule({});
    service = TestBed.inject(VisualizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
=======
    localStorage.clear();
    const updates = new Subject<VisualizerDocument[]>();
    service = new VisualizerService(catalogFrom(updates));
    updates.next(VISUALIZER_PRESETS.map(preset => ({ ...preset, description: '', enabled: true })));
  });

  afterEach(() => { service.ngOnDestroy(); localStorage.clear(); });

  it('starts Off on the first visit without automatically selecting a preset', () => {
    expect(service.activePresetId).toBeNull();
    expect(service.calculatePaths(1)).toEqual([]);
  });

  it('has no local catalog before Firestore returns documents or without a catalog provider', () => {
    const empty = new VisualizerService();
    expect(empty.getPresets()).toEqual([]);
    expect(empty.setPreset('aurora-wave')).toBeFalse();
    empty.ngOnDestroy();
    const pending = new VisualizerService(catalogFrom(new Subject<VisualizerDocument[]>()));
    expect(pending.getPresets()).toEqual([]);
    expect(pending.activeConfig).toBeNull();
    pending.ngOnDestroy();
  });

  it('exposes the names of documents received from Firestore', () => {
    expect(service.getPresets().map(preset => preset.name)).toEqual([
      'Waveform', 'Equalizer', 'Firefly Garden'
    ]);
  });

  it('offers only the received documents and a single active configuration', () => {
    expect(service.getPresets().length).toBe(3);
    expect(service.setPreset('aurora-wave')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('wave');
    expect(service.setPreset('pulse-bars')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('bars');
    expect(service.setPreset('missing')).toBeFalse();
    expect(service.activeConfig?.id).toBe('pulse-bars');
  });

  it('keeps each artistic style distinct while preserving its audio geometry', () => {
    const presets = service.getPresets();
    expect(new Set(presets.map(preset => preset.visualStyle)).size).toBe(3);
    for (const preset of presets) {
      expect(service.setPreset(preset.id)).toBeTrue();
      expect(service.activeConfig?.visualStyle).toBe(preset.visualStyle);
      expect(service.calculatePaths(1, 64).length).toBe(preset.layers);
    }
  });

  it('normalizes an unsupported visual style', () => {
    service.setPreset('moonlit-fireflies');
    service.updateParameters({ visualStyle: 'invalid' as any });
    expect(service.activeConfig?.visualStyle).toBe('silk');
  });

  it('rejects removed visualizers and starts Off when a removed selection was stored', () => {
    const removed = ['neon-meteor-rain', 'lotus-dream', 'orbit-bloom', 'lissajous-dream', 'cosmic-spiral'];
    expect(service.getPresets().some(p => removed.includes(p.id))).toBeFalse();
    for (const id of removed) {
      expect(service.setPreset(id)).toBeFalse();
      localStorage.setItem('lofi.visualizer.preset.v1', id);
      expect(new VisualizerService().activePresetId).toBeNull();
    }
  });

  it('disables rendering and remembers the off selection', () => {
    service.setPreset(null);
    expect(service.calculatePaths(1)).toEqual([]);
    expect(new VisualizerService().activeConfig).toBeNull();
  });

  it('generates finite points for all presets', () => {
    for (const preset of service.getPresets()) {
      service.setPreset(preset.id);
      const paths = service.calculatePaths(1.5);
      expect(paths.length).toBe(preset.layers);
      for (const path of paths) {
        expect(path.points.length).toBeGreaterThan(0);
        for (const point of path.points) {
          expect(Number.isFinite(point.x)).toBeTrue();
          expect(Number.isFinite(point.y)).toBeTrue();
        }
      }
    }
  });

  it('is deterministic for the same time and configuration', () => {
    service.setPreset('aurora-wave');
    expect(service.calculatePaths(2, 100)).toEqual(service.calculatePaths(2, 100));
  });

  it('changes with parameters or time while real audio is present', () => {
    service.setPreset('aurora-wave');
    const live = {
      source: 'tab' as const, level: 0.65, bass: 0.6, mids: 0.4,
      treble: 0.3, beat: 0.3, spectrum: new Array(64).fill(0.5)
    };
    const before = service.calculatePoints(1, 128, live);
    service.updateParameters({ amplitude: 95, frequency: 7 });
    expect(service.calculatePoints(1, 128, live)).not.toEqual(before);
    expect(service.calculatePoints(2, 128, live)).not.toEqual(service.calculatePoints(1, 128, live));
  });

  it('clamps invalid numeric parameters and restores a preset', () => {
    service.setPreset('aurora-wave');
    service.updateParameters({ amplitude: Infinity, harmonics: NaN, layers: 100, speed: -8 });
    expect(service.activeConfig?.amplitude).toBe(30);
    expect(service.activeConfig?.harmonics).toBe(2);
    expect(service.activeConfig?.layers).toBe(8);
    expect(service.activeConfig?.speed).toBe(0);
    service.resetParameters();
    expect(service.activeConfig?.layers).toBe(4);
  });

  it('does not expose mutable preset references', () => {
    const preset = service.getPresets()[0];
    preset.amplitude = 0;
    expect(service.getPresets()[0].amplitude).not.toBe(0);
  });

  it('renders a draft without changing the selected preset or local preference', () => {
    service.setPreset('pulse-bars');
    const selected = service.activeConfig;
    const draft = service.getPresets()[0];
    const frame = { source: 'tab' as const, level: 0.6, bass: 0.5, mids: 0.4,
      treble: 0.3, beat: 0.8, spectrum: new Array(64).fill(0.6) };
    const result = service.calculatePathsForConfig(draft, 1, undefined, frame);
    expect(result[0].kind).toBe('curve');
    expect(service.activeConfig).toEqual(selected);
    expect(localStorage.getItem('lofi.visualizer.preset.v1')).toBe('pulse-bars');
  });

  it('bounds draft geometry before iterating even for huge or non-finite inputs', () => {
    const draft = { ...service.getPresets()[0], layers: 1e9, harmonics: 1e9,
      resolution: 1e9, amplitude: Infinity, frequency: NaN, phase: Infinity };
    const frame = { source: 'tab' as const, level: 0.6, bass: 0.5, mids: 0.4,
      treble: 0.3, beat: 0.8, spectrum: new Array(64).fill(0.6) };
    const waves = service.calculatePathsForConfig(draft, Infinity, Infinity, frame);
    expect(waves.length).toBe(8);
    expect(waves.every(path => path.points.length === 768)).toBeTrue();
    expect(waves.every(path => path.points.every(point => Number.isFinite(point.y)))).toBeTrue();
    const bars = service.calculatePathsForConfig({ ...draft, geometry: 'bars', barCount: 1e9 }, 1, undefined, frame);
    expect(bars.every(path => path.points.length === 96)).toBeTrue();
    const incomplete = service.calculatePathsForConfig({ ...draft, layers: NaN, harmonics: Infinity,
      resolution: NaN, barCount: NaN }, 1, undefined, frame);
    expect(incomplete.length).toBe(3);
    expect(incomplete.every(path => path.points.length === 256)).toBeTrue();
    expect(draft.layers).toBe(1e9);
    expect(service.activeConfig).toBeNull();
  });

  it('restores a cloud selection after the asynchronous catalog arrives', () => {
    const updates = new Subject<VisualizerDocument[]>();
    localStorage.setItem('lofi.visualizer.preset.v1', 'cloud-dream');
    const cloud = new VisualizerService(catalogFrom(updates));
    expect(cloud.activePresetId).toBeNull();
    updates.next([{ ...service.getPresets()[0], id: 'cloud-dream', name: 'Cloud dream',
      description: '', enabled: true }]);
    expect(cloud.activePresetId).toBe('cloud-dream');
    expect(cloud.getPresets().length).toBe(1);
    cloud.ngOnDestroy();
  });

  it('honors Off chosen while a remembered cloud selection is loading', () => {
    const updates = new Subject<VisualizerDocument[]>();
    localStorage.setItem('lofi.visualizer.preset.v1', 'cloud-dream');
    const cloud = new VisualizerService(catalogFrom(updates));
    cloud.setPreset(null);
    updates.next([{ ...service.getPresets()[0], id: 'cloud-dream', name: 'Cloud dream',
      description: '', enabled: true }]);
    expect(cloud.activePresetId).toBeNull();
    cloud.ngOnDestroy();
  });

  it('updates published effects in real time and turns a removed selection off', () => {
    const updates = new Subject<VisualizerDocument[]>();
    const cloud = new VisualizerService(catalogFrom(updates));
    const document = { ...service.getPresets()[0], id: 'cloud-dream', name: 'Cloud dream',
      description: '', enabled: true };
    let lastNames: string[] = [];
    cloud.presets$.subscribe(presets => lastNames = presets.map(preset => preset.name));
    updates.next([document]);
    cloud.setPreset(document.id);
    updates.next([{ ...document, name: 'Moonlight', amplitude: 80 }]);
    expect(cloud.activeConfig?.amplitude).toBe(80);
    expect(lastNames).toContain('Moonlight');
    updates.next([]);
    expect(cloud.activeConfig).toBeNull();
    expect(lastNames.length).toBe(0);
    expect(localStorage.getItem('lofi.visualizer.preset.v1')).toBe('off');
    cloud.ngOnDestroy();
  });

  it('keeps an empty catalog with Off on a database error and never adds bundled effects', () => {
    const updates = new Subject<VisualizerDocument[]>();
    const cloud = new VisualizerService(catalogFrom(updates));
    updates.error(new Error('unavailable'));
    expect(cloud.getPresets()).toEqual([]);
    expect(cloud.setPreset('aurora-wave')).toBeFalse();
    expect(cloud.activeConfig).toBeNull();
    cloud.ngOnDestroy();
  });

  it('clears previously loaded records on error and reloads only database results on retry', () => {
    const updates = new Subject<VisualizerDocument[]>();
    const catalog = catalogFrom(updates) as jasmine.SpyObj<VisualizerCatalogService>;
    const cloud = new VisualizerService(catalog);
    const document = { ...VISUALIZER_PRESETS[0], id: 'cloud-only', description: '', enabled: true };
    const states: string[] = [];
    cloud.catalogStatus$.subscribe(state => states.push(state));
    updates.next([document]);
    cloud.setPreset(document.id);
    updates.error(new Error('unavailable'));
    expect(cloud.getPresets()).toEqual([]);
    expect(cloud.activeConfig).toBeNull();
    const retry = new Subject<VisualizerDocument[]>();
    catalog.watchPublished.and.returnValue(retry);
    cloud.reloadCatalog();
    retry.next([document]);
    expect(cloud.getPresets().map(preset => preset.id)).toEqual(['cloud-only']);
    expect(states).toEqual(['loading', 'ready', 'error', 'loading', 'ready']);
    expect(cloud.activeConfig).toBeNull();
    cloud.ngOnDestroy();
  });

  it('renders distinct sine, triangle and sawtooth wave profiles with bounded coordinates', () => {
    const config = { ...VISUALIZER_PRESETS[0], harmonics: 1 };
    const audio = { source: 'tab' as const, level: 0.65, bass: 0.6, mids: 0.4,
      treble: 0.3, beat: 0.3, spectrum: new Array(64).fill(0.5) };
    const sine = service.calculatePathsForConfig({ ...config, waveShape: 'sine' }, 1, 64, audio);
    const triangle = service.calculatePathsForConfig({ ...config, waveShape: 'triangle' }, 1, 64, audio);
    const sawtooth = service.calculatePathsForConfig({ ...config, waveShape: 'sawtooth' }, 1, 64, audio);
    expect(triangle).not.toEqual(sine);
    expect(sawtooth).not.toEqual(sine);
    expect(sawtooth).not.toEqual(triangle);
    for (const result of [sine, triangle, sawtooth]) {
      expect(result.every(path => path.points.every(point => Number.isFinite(point.y) && point.y >= 0 && point.y <= 1))).toBeTrue();
    }
  });

  it('keeps spectrum heights independent of the renderer bar layout', () => {
    const audio = { source: 'tab' as const, level: 0.65, bass: 0.6, mids: 0.4,
      treble: 0.3, beat: 0.3, spectrum: new Array(64).fill(0.5) };
    const bottom = service.calculatePathsForConfig({ ...VISUALIZER_PRESETS[1], barLayout: 'bottom' }, 1, 64, audio);
    const top = service.calculatePathsForConfig({ ...VISUALIZER_PRESETS[1], barLayout: 'top' }, 1, 64, audio);
    const center = service.calculatePathsForConfig({ ...VISUALIZER_PRESETS[1], barLayout: 'center' }, 1, 64, audio);
    expect(top).toEqual(bottom);
    expect(center).toEqual(bottom);
  });

  it('changes wave geometry in response to real tab audio', () => {
    service.setPreset('aurora-wave');
    const idle = service.calculatePaths(0.5, 128);
    const live = service.calculatePaths(0.5, 128, {
      source: 'tab', level: 0.55, bass: 0.85, mids: 0.3, treble: 0.2,
      beat: 1, spectrum: new Array(64).fill(0.3)
    });
    expect(live).not.toEqual(idle);
  });

  it('drives bars from actual spectrum rather than an animated sine', () => {
    service.setPreset('pulse-bars');
    const quiet = service.calculatePaths(2, undefined, {
      source: 'tab', level: 0.1, bass: 0.1, mids: 0.1, treble: 0.1,
      beat: 0, spectrum: new Array(64).fill(0)
    });
    const loud = service.calculatePaths(2, undefined, {
      source: 'tab', level: 0.7, bass: 0.8, mids: 0.5, treble: 0.5,
      beat: 0.8, spectrum: new Array(64).fill(0.85)
    });
    expect(loud[0].points[10].y).toBeLessThan(quiet[0].points[10].y);
  });

  it('uses palette tokens for every preset', () => {
    const valid = ['theme', 'accent', 'secondary', 'accentLight', 'text'];
    service.getPresets().forEach(preset => {
      expect(valid).toContain(preset.color);
      expect(valid).toContain(preset.secondaryColor);
      expect(preset.audioSensitivity).toBeGreaterThan(0);
    });
  });

  it('places every bar at the very bottom when the tab is silent', () => {
    service.setPreset('pulse-bars');
    const silence = {
      source: 'tab' as const, level: 0, bass: 0, mids: 0, treble: 0, beat: 0.8,
      spectrum: new Array(64).fill(0)
    };
    expect(service.getAudioActivity(silence)).toBe(0);
    const paths = service.calculatePaths(5, undefined, silence);
    for (const path of paths) {
      expect(path.kind).toBe('bar');
      for (const point of path.points) expect(point.y).toBe(1);
    }
  });

  it('raises the bars from the bottom when their frequency bands have audio', () => {
    service.setPreset('pulse-bars');
    const live = {
      source: 'tab' as const, level: 0.6, bass: 0.5, mids: 0.4, treble: 0.2, beat: 1,
      spectrum: new Array(64).fill(0.7)
    };
    const bars = service.calculatePaths(2, undefined, live)[0].points;
    expect(bars.every(point => point.y >= 0 && point.y < 1)).toBeTrue();
  });

  it('collapses all non-bar shapes in silence and expands with sound', () => {
    const silent = {
      source: 'tab' as const, level: 0, bass: 0, mids: 0, treble: 0, beat: 0,
      spectrum: new Array(64).fill(0)
    };
    const loud = {
      source: 'tab' as const, level: 0.8, bass: 0.6, mids: 0.5, treble: 0.3, beat: 1,
      spectrum: new Array(64).fill(0.6)
    };
    for (const preset of service.getPresets().filter(p => p.geometry !== 'bars')) {
      service.setPreset(preset.id);
      const idle = service.calculatePaths(1, undefined, silent)[0].points;
      const active = service.calculatePaths(1, undefined, loud)[0].points;
      if (preset.geometry !== 'wave') {
        expect(idle.every(p => Math.abs(p.x - 0.5) < 0.000001 &&
          Math.abs(p.y - 0.5) < 0.000001)).toBeTrue();
      } else {
        expect(idle.every(p => Math.abs(p.y - 0.5) < 0.000001)).toBeTrue();
      }
      expect(active).not.toEqual(idle);
    }
  });

  it('does not use lingering beat decay as proof of audible sound', () => {
    const silentWithBeat = {
      source: 'tab' as const, level: 0, bass: 0, mids: 0, treble: 0,
      beat: 1, spectrum: new Array(64).fill(0)
    };
    expect(service.getAudioActivity(silentWithBeat)).toBe(0);
    expect(service.getAudioActivity()).toBe(0);
  });

  it('exposes an accessible Material icon for each configurable preset', () => {
    for (const preset of service.getPresets()) {
      expect(preset.icon).toMatch(/^[a-z_]+$/);
    }
    service.setPreset('pulse-bars');
    service.updateParameters({ icon: 'INVALID ICON' });
    expect(service.activeConfig?.icon).toBe('graphic_eq');
  });


>>>>>>> Stashed changes
});
