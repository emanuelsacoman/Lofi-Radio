import { VisualizerService } from './visualizer.service';

describe('VisualizerService procedural engine', () => {
  let service: VisualizerService;

  beforeEach(() => {
    localStorage.clear();
    service = new VisualizerService();
  });

  afterEach(() => localStorage.clear());

  it('offers five configurable presets and a single active configuration', () => {
    expect(service.getPresets().length).toBe(5);
    expect(service.setPreset('orbit-bloom')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('circle');
    expect(service.setPreset('pulse-bars')).toBeTrue();
    expect(service.activeConfig?.geometry).toBe('bars');
    expect(service.setPreset('missing')).toBeFalse();
    expect(service.activeConfig?.id).toBe('pulse-bars');
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

  it('changes when parameters or time change', () => {
    service.setPreset('aurora-wave');
    const before = service.calculatePoints(1);
    service.updateParameters({ amplitude: 95, frequency: 7 });
    expect(service.calculatePoints(1)).not.toEqual(before);
    expect(service.calculatePoints(2)).not.toEqual(service.calculatePoints(1));
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

});
