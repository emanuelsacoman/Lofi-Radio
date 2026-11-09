import { VisualizerService } from './visualizer.service';

describe('VisualizerService procedural engine', () => {
  let service: VisualizerService;

  beforeEach(() => {
    localStorage.clear();
    service = new VisualizerService();
  });

  afterEach(() => localStorage.clear());

  it('starts Off on the first visit without automatically selecting a preset', () => {
    expect(service.activePresetId).toBeNull();
    expect(service.calculatePaths(1)).toEqual([]);
  });

  it('has English names for every visualizer icon', () => {
    expect(service.getPresets().map(preset => preset.name)).toEqual([
      'Waveform', 'Orbit', 'Spiral', 'Equalizer', 'Lissajous',
      'Firefly Garden', 'Meteor Shower', 'Lotus Dream'
    ]);
  });

  it('offers eight configurable presets and a single active configuration', () => {
    expect(service.getPresets().length).toBe(8);
    expect(service.setPreset('orbit-bloom')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('circle');
    expect(service.setPreset('pulse-bars')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('bars');
    expect(service.setPreset('missing')).toBeFalse();
    expect(service.activeConfig?.id).toBe('pulse-bars');
  });

  it('keeps each artistic style distinct while preserving its audio geometry', () => {
    const presets = service.getPresets();
    expect(new Set(presets.map(preset => preset.visualStyle)).size).toBe(8);
    for (const preset of presets) {
      expect(service.setPreset(preset.id)).toBeTrue();
      expect(service.activeConfig?.visualStyle).toBe(preset.visualStyle);
      expect(service.calculatePaths(1, 64).length).toBe(preset.layers);
    }
  });

  it('normalizes an unsupported visual style', () => {
    service.setPreset('lotus-dream');
    service.updateParameters({ visualStyle: 'invalid' as any });
    expect(service.activeConfig?.visualStyle).toBe('silk');
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

  it('keeps a circular seam closed', () => {
    service.setPreset('orbit-bloom');
    const curve = service.calculatePaths(1)[0].points;
    expect(curve[0].x).toBeCloseTo(curve[curve.length - 1].x, 8);
    expect(curve[0].y).toBeCloseTo(curve[curve.length - 1].y, 8);
  });

  it('does not expose mutable preset references', () => {
    const preset = service.getPresets()[0];
    preset.amplitude = 0;
    expect(service.getPresets()[0].amplitude).not.toBe(0);
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


});
