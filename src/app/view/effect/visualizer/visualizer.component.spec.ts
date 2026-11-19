import { SimpleChange } from '@angular/core';
import { of } from 'rxjs';
import { VISUALIZER_PRESETS } from 'src/app/services/visualizer-presets';
import { VisualizerConfig } from 'src/app/services/interfaces/visualizer/visualizerconfig';
import { ComponentFixture, TestBed } from '@angular/core/testing';
<<<<<<< Updated upstream

import { VisualizerComponent } from './visualizer.component';
=======
import { VisualizerComponent, fireflyAudioResponse, fireflyFlight, fireflyEcho } from './visualizer.component';
import { VisualizerService } from 'src/app/services/visualizer.service';
import { VisualizerCatalogService } from 'src/app/services/visualizer-catalog.service';
import { VisualizerAudioService } from 'src/app/services/visualizer-audio.service';
>>>>>>> Stashed changes

describe('VisualizerComponent', () => {
  let component: VisualizerComponent;
  let fixture: ComponentFixture<VisualizerComponent>;

  beforeEach(() => {
<<<<<<< Updated upstream
    TestBed.configureTestingModule({
      declarations: [VisualizerComponent]
=======
    localStorage.clear();
    TestBed.configureTestingModule({
      declarations: [VisualizerComponent],
      providers: [{ provide: VisualizerCatalogService, useValue: { watchPublished: () => of(VISUALIZER_PRESETS) } }]
>>>>>>> Stashed changes
    });
    fixture = TestBed.createComponent(VisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
<<<<<<< Updated upstream
=======
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });

  it('previews the draft without capturing audio or replacing the player selection', () => {
    service.setPreset('aurora-wave');
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D', ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke']
    );
    const audio = TestBed.inject(VisualizerAudioService);
    const readAudio = spyOn(audio, 'readFrame').and.callThrough();
    (component as any).ctx = ctx;
    (component as any).width = 640;
    (component as any).height = 360;
    component.playing = false;
    component.previewMode = true;
    component.previewConfig = service.getPresets().find(preset => preset.id === 'pulse-bars')!;
    component.ngOnChanges({ previewConfig: new SimpleChange(null, component.previewConfig, true) });
    expect(ctx.stroke).toHaveBeenCalled();
    expect(readAudio).not.toHaveBeenCalled();
    expect(service.activePresetId).toBe('aurora-wave');
    expect((component as any).frameId).toBeNull();
    expect((component as any).config.id).toBe('pulse-bars');
    service.setPreset('moonlit-fireflies');
    expect((component as any).config.id).toBe('pulse-bars');
  });

  it('updates a paused preview immediately when draft parameters change', () => {
    component.previewMode = true;
    component.playing = false;
    const draft = service.getPresets()[0];
    component.previewConfig = draft;
    component.ngOnChanges({ previewConfig: new SimpleChange(null, draft, true) });
    const render = spyOn<any>(component, 'render');
    component.previewConfig = { ...draft, color: '#ffffff' };
    component.ngOnChanges({ previewConfig: new SimpleChange(draft, component.previewConfig, false) });
    expect(render).toHaveBeenCalled();
    expect((component as any).config.color).toBe('#ffffff');
    expect((component as any).frameId).toBeNull();
  });

  it('normalizes incomplete editor values before rendering without mutating the form draft', () => {
    component.previewMode = true;
    component.playing = false;
    component.previewConfig = { ...service.getPresets()[0], layers: 1e9, harmonics: 1e9,
      barCount: 1e9, glow: NaN, lineWidth: Infinity, color: '' };
    component.ngOnChanges({ previewConfig: new SimpleChange(null, component.previewConfig, true) });
    const config = (component as any).config;
    expect(config.layers).toBe(8);
    expect(config.harmonics).toBe(12);
    expect(config.barCount).toBe(96);
    expect(config.glow).toBe(10);
    expect(config.lineWidth).toBe(2);
    expect(config.color).toBe('theme');
    expect(component.previewConfig.layers).toBe(1e9);
    expect(service.activeConfig).toBeNull();
  });

  it('resolves palette tokens inherited from the preview container', () => {
    fixture.nativeElement.style.setProperty('--clr-primary', '#123456');
    fixture.nativeElement.style.setProperty('--clr-accent-light', '#abcdef');
    expect((component as any).color('theme', '--clr-primary', '#000000')).toBe('#123456');
    expect((component as any).color('accentLight', '--clr-accent', '#000000')).toBe('#abcdef');
  });

  it('renders captured audio even if the YouTube playing flag is temporarily false', () => {
    service.setPreset('pulse-bars');
    component.playing = false;

    // Render against a mock canvas to test the drawing gate independently
    // of browser permissions and the visible dimensions of the test fixture.
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke']
    );
    (component as any).ctx = ctx;
    (component as any).width = 640;
    (component as any).height = 360;

    (component as any).render({
      source: 'tab',
      level: 0.8, bass: 0.7, mids: 0.6, treble: 0.3, beat: 1,
      spectrum: new Array(64).fill(0.85)
    });

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('keeps the canvas clear during silence', () => {
    service.setPreset('aurora-wave');
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke']
    );
    (component as any).ctx = ctx;
    (component as any).width = 640;
    (component as any).height = 360;
    (component as any).render({
      source: 'tab',
      level: 0, bass: 0, mids: 0, treble: 0, beat: 0,
      spectrum: new Array(64).fill(0)
    });
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('blinks asynchronously rather than staying illuminated or zooming', () => {
    const music = {
      source: 'tab' as const,
      level: 0.65, bass: 0.75, mids: 0.6, treble: 0.6, beat: 0.9,
      spectrum: new Array(64).fill(0.8)
    };
    const period = 2.4 + (1 / 1.5) * 2.2;
    const peak = fireflyAudioResponse(music, 0.8, 1, period * 0.11, 0, 1);
    const dark = fireflyAudioResponse(music, 0.8, 1, period * 0.6, 0, 1);
    const staggered = fireflyAudioResponse(music, 0.8, 1, period * 0.11, Math.PI, 1);

    expect(peak.alpha).toBeGreaterThan(0.8);
    expect(dark.alpha).toBe(0);
    expect(staggered.alpha).toBe(0);
    expect(Object.keys(peak)).toEqual(['alpha']);
  });

  it('lets the music brighten individual flashes and vary with frequency bands', () => {
    const low = {
      source: 'tab' as const,
      level: 0.05, bass: 0.04, mids: 0.08, treble: 0.02, beat: 0,
      spectrum: new Array(64).fill(0.02)
    };
    const loud = {
      source: 'tab' as const,
      level: 0.65, bass: 0.75, mids: 0.6, treble: 0.6, beat: 0.9,
      spectrum: new Array(64).fill(0.8)
    };
    const time = (2.4 + (1 / 1.5) * 2.2) * 0.11;
    const calm = fireflyAudioResponse(low, 0.02, 1, time, 0, 1);
    const music = fireflyAudioResponse(loud, 0.8, 1, time, 0, 1);
    const withoutBeat = fireflyAudioResponse({ ...loud, beat: 0 }, 0.8, 1, time, 0, 1);
    const lowBand = fireflyAudioResponse(loud, 0, 1, time, 0, 1);

    expect(music.alpha).toBeGreaterThan(calm.alpha + 0.25);
    expect(music.alpha).toBeGreaterThan(withoutBeat.alpha);
    expect(music.alpha).toBeGreaterThan(lowBand.alpha);
  });

  it('can produce a softer second flash on some fireflies', () => {
    const music = {
      source: 'tab' as const,
      level: 0.65, bass: 0.75, mids: 0.6, treble: 0.6, beat: 0.9,
      spectrum: new Array(64).fill(0.8)
    };
    const phase = Math.PI * 1.5;
    const period = 2.4 + (1 / 1.5) * 2.2;
    const time = period * 0.55; // fractional position 0.3 after phase=0.75
    expect(fireflyAudioResponse(music, 0.8, 1, time, phase, 1).alpha).toBeGreaterThan(0.4);
    expect(fireflyAudioResponse(music, 0.8, 1, time, 0, 1).alpha).toBe(0);
  });

  it('never blinks without real tab activity, even with lingering beat decay', () => {
    const beatOnly = {
      source: 'tab' as const,
      level: 0, bass: 0, mids: 0, treble: 0, beat: 1,
      spectrum: new Array(64).fill(0)
    };
    expect(fireflyAudioResponse(beatOnly, 0, 0, 1, 0, 1)).toEqual({ alpha: 0 });
    expect(fireflyAudioResponse({ ...beatOnly, source: 'none' }, 1, 1, 1, 0, 1))
      .toEqual({ alpha: 0 });
  });

  it('keeps individual Firefly sprite sizes fixed as audio intensity changes', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D', ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'drawImage']
    );
    (component as any).ctx = ctx;
    (component as any).width = 1280;
    (component as any).height = 720;
    service.setPreset('moonlit-fireflies');

    const softMusic = {
      source: 'tab' as const,
      level: 0.35, bass: 0.24, mids: 0.25, treble: 0.2, beat: 0,
      spectrum: new Array(64).fill(0.20)
    };
    (component as any).render(softMusic);
    const sizesBefore = ctx.drawImage.calls.allArgs().map(args => [args[3], args[4]]);
    expect(sizesBefore.length).toBeGreaterThan(0);
    expect(sizesBefore.length).toBeLessThanOrEqual(18);

    ctx.drawImage.calls.reset();
    (component as any).render({
      ...softMusic, level: 0.8, bass: 0.75, mids: 0.6, treble: 0.8,
      spectrum: new Array(64).fill(0.8)
    });
    const sizesAfter = ctx.drawImage.calls.allArgs().map(args => [args[3], args[4]]);
    expect(sizesAfter).toEqual(sizesBefore);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.shadowBlur).toBe(0);
  });

  it('makes a slow, bounded flight instead of zooming or jumping across the screen', () => {
    const seed = { x: 0.35, y: 0.58, phase: 1.2, speed: 0.9, size: 1.4, depth: 0.9 };
    const a = fireflyFlight(seed, 0);
    const b = fireflyFlight(seed, 20);
    const c = fireflyFlight(seed, 20.04);
    expect(b).not.toEqual(a);
    expect(fireflyFlight(seed, 20)).toEqual(b);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(0.002);
    for (const t of [0, 5, 25, 100]) {
      const p = fireflyFlight(seed, t);
      expect(p.x).toBeGreaterThan(0.04);
      expect(p.x).toBeLessThan(0.96);
      expect(p.y).toBeGreaterThan(0.08);
      expect(p.y).toBeLessThan(0.92);
    }
  });

  it('creates a four-step call-and-response ripple only from detected beats', () => {
    expect(fireflyEcho(0.155, 0)).toBeGreaterThan(0.7);
    expect(fireflyEcho(0.155, 5)).toBeLessThan(0.01);
    expect(fireflyEcho(0.305, 5)).toBeGreaterThan(0.7);
    expect(fireflyEcho(0.155, 1)).toBe(0);
    expect(fireflyEcho(-1, 0)).toBe(0);
    expect(fireflyEcho(Infinity, 0)).toBe(0);

    const loud = {
      source: 'tab' as const,
      level: 0.7, bass: 0.8, mids: 0.6, treble: 0.7, beat: 1,
      spectrum: new Array(64).fill(0.6)
    };
    const darkTime = 2.2; // away from the first seed's independent blink
    const natural = fireflyAudioResponse(loud, 0.6, 1, darkTime, 0, 1);
    const answer = fireflyAudioResponse(loud, 0.6, 1, darkTime, 0, 1, 0.78);
    expect(answer.alpha).toBeGreaterThan(natural.alpha);
    expect(fireflyAudioResponse({ ...loud, source: 'none' }, 0.6, 1, darkTime, 0, 1, 0.78).alpha).toBe(0);
  });

  it('renders Firefly with cached glow sprites and without blurred strokes', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
        'stroke', 'arc', 'fill', 'drawImage']
    );
    (component as any).ctx = ctx;
    (component as any).width = 1280;
    (component as any).height = 720;
    const audio = {
      source: 'tab' as const,
      level: 0.7, bass: 0.6, mids: 0.5, treble: 0.8, beat: 0.9,
      spectrum: new Array(64).fill(0.7)
    };
    expect(service.setPreset('moonlit-fireflies')).toBeTrue();
    (component as any).render(audio);

    const firstFrameDraws = ctx.drawImage.calls.count();
    expect(firstFrameDraws).toBeGreaterThan(0);
    expect(firstFrameDraws).toBeLessThanOrEqual(18);
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.globalCompositeOperation).toBe('source-over');

    const cachedSprites = (component as any).fireflySprites;
    expect(cachedSprites).toBeTruthy();
    (component as any).render(audio);
    expect(ctx.drawImage.calls.count()).toBe(firstFrameDraws * 2);
    expect((component as any).fireflySprites).toBe(cachedSprites);
  });

  it('respects the configured Firefly density on narrow screens', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D', ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'drawImage']
    );
    (component as any).ctx = ctx;
    (component as any).width = 390;
    (component as any).height = 700;
    service.setPreset('moonlit-fireflies');
    (component as any).render({
      source: 'tab', level: 0.7, bass: 0.4, mids: 0.5, treble: 0.4, beat: 0.5,
      spectrum: new Array(64).fill(0.5)
    });
    expect(ctx.drawImage.calls.count()).toBeGreaterThan(0);
    expect(ctx.drawImage.calls.count()).toBeLessThanOrEqual(18);
  });

  it('keeps every atmosphere completely dark in genuine silence, even with beat decay', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'arc', 'fill']
    );
    (component as any).ctx = ctx;
    (component as any).width = 800;
    (component as any).height = 450;
    const silence = {
      source: 'tab' as const,
      level: 0, bass: 0, mids: 0, treble: 0, beat: 1,
      spectrum: new Array(64).fill(0)
    };

    for (const preset of service.getPresets()) {
      service.setPreset(preset.id);
      (component as any).render(silence);
    }
    expect(ctx.clearRect.calls.count()).toBeGreaterThanOrEqual(service.getPresets().length);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('accepts switching the active preset off', () => {
    expect(service.setPreset(null)).toBeTrue();
    expect(service.calculatePaths(1)).toEqual([]);
>>>>>>> Stashed changes
  });

  it('positions, rotates, scales and mirrors each frame without accumulating transforms', () => {
    const ctx = contextSpy();
    installConfig(ctx, { ...VISUALIZER_PRESETS[0], scale: 1.5, positionX: 20, positionY: -10, angle: 90, mirrorX: true });
    (component as any).render(music());
    (component as any).render(music());

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(ctx.translate).toHaveBeenCalledWith(448, 144);
    expect(ctx.translate).toHaveBeenCalledWith(-320, -180);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.scale).toHaveBeenCalledWith(-1.5, 1.5);
    expect(ctx.save.calls.count()).toBe(2);
    expect(ctx.restore.calls.count()).toBe(2);
  });

  it('restores the canvas transform after drawing particles too', () => {
    const ctx = contextSpy();
    installConfig(ctx, { ...VISUALIZER_PRESETS[2], scale: 0.5, angle: -30 });
    (component as any).render(music());
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('uses the two chosen colors in a continuous gradient or only the main color in solid mode', () => {
    const ctx = contextSpy();
    const gradient = jasmine.createSpyObj<CanvasGradient>('gradient', ['addColorStop']);
    ctx.createLinearGradient.and.returnValue(gradient);
    const config = { ...VISUALIZER_PRESETS[1], color: '#ff0000', secondaryColor: '#0000ff' };
    installConfig(ctx, { ...config, colorMode: 'gradient' });
    (component as any).render(music());
    expect(gradient.addColorStop).toHaveBeenCalledWith(0, '#ff0000');
    expect(gradient.addColorStop).toHaveBeenCalledWith(1, '#0000ff');
    expect(ctx.strokeStyle).toBe(gradient);

    installConfig(ctx, { ...config, colorMode: 'solid' });
    (component as any).render(music());
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.fillStyle).toBe('#ff0000');
  });

  it('lets the wave veil be removed without hiding its curves', () => {
    const ctx = contextSpy();
    installConfig(ctx, { ...VISUALIZER_PRESETS[0], veilOpacity: 0 });
    (component as any).render(music());
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('draws the equalizer from the chosen edge or symmetrically around its center', () => {
    const ctx = contextSpy();
    const path = { points: [{ x: 0.25, y: 0.25 }], kind: 'bar', layer: 0, closed: false };
    const cases = [
      { barLayout: 'bottom' as const, start: 360, end: 90 },
      { barLayout: 'top' as const, start: 0, end: 270 },
      { barLayout: 'center' as const, start: 315, end: 45 }
    ];
    for (const sample of cases) {
      installConfig(ctx, { ...VISUALIZER_PRESETS[1], barLayout: sample.barLayout });
      ctx.moveTo.calls.reset();
      ctx.lineTo.calls.reset();
      ctx.arc.calls.reset();
      (component as any).drawBars(ctx, path, 12);
      expect(ctx.moveTo).toHaveBeenCalledWith(160, sample.start);
      expect(ctx.lineTo).toHaveBeenCalledWith(160, sample.end);
      (component as any).drawSpectrumSparks(ctx, path, music(), 1, '#ffffff');
      expect(ctx.arc.calls.first().args[1]).toBe(sample.end);
      if (sample.barLayout === 'center') expect(ctx.arc.calls.mostRecent().args[1]).toBe(sample.start);
    }
  });

  it('changes bar separation while retaining the selected bar count', () => {
    const ctx = contextSpy();
    const path = { points: [{ x: 0.5, y: 0.3 }], kind: 'bar', layer: 0, closed: false };
    installConfig(ctx, { ...VISUALIZER_PRESETS[1], barGap: 0.1 });
    (component as any).drawBars(ctx, path, 24);
    const wide = ctx.lineWidth;
    installConfig(ctx, { ...VISUALIZER_PRESETS[1], barGap: 0.9 });
    (component as any).drawBars(ctx, path, 24);
    expect(ctx.lineWidth).toBeLessThan(wide / 4);
  });

  it('customizes particle density and size independently of the audio intensity', () => {
    const ctx = contextSpy();
    // Fireflies have dark intervals: sample a complete blink cycle instead of
    // assuming one particular instant illuminates one of the first four seeds.
    const sample = (particleCount: number, particleSize = 1): number[][] => {
      installConfig(ctx, { ...VISUALIZER_PRESETS[2], particleCount, particleSize });
      return Array.from({ length: 32 }, (_, frame) => {
        (component as any).time = frame * 0.25;
        ctx.drawImage.calls.reset();
        (component as any).render({ ...music(), beat: 0 });
        return ctx.drawImage.calls.allArgs().map(args => Number(args[3]));
      });
    };
    const sparse = sample(4);
    const sparseCount = sparse.reduce((count, frame) => count + frame.length, 0);
    expect(sparseCount).toBeGreaterThan(0);
    expect(sparse.every(frame => frame.length <= 4)).toBeTrue();

    const dense = sample(96);
    const denseCount = dense.reduce((count, frame) => count + frame.length, 0);
    expect(denseCount).toBeGreaterThan(sparseCount);
    expect(dense.every(frame => frame.length <= 96)).toBeTrue();

    expect(sample(96, 2)).toEqual(dense.map(frame => frame.map(size => size * 2)));
  });

  it('contracts particle positions around the center without changing their size', () => {
    const ctx = contextSpy();
    installConfig(ctx, { ...VISUALIZER_PRESETS[2], particleSpread: 1 });
    (component as any).render(music());
    const full = ctx.drawImage.calls.allArgs();
    installConfig(ctx, { ...VISUALIZER_PRESETS[2], particleSpread: 0.5 });
    ctx.drawImage.calls.reset();
    (component as any).render(music());
    const compact = ctx.drawImage.calls.allArgs();
    expect(compact.length).toBe(full.length);
    full.forEach((args, i) => {
      const size = Number(args[3]);
      expect(Number(compact[i][1]) + size / 2 - 320)
        .toBeCloseTo((Number(args[1]) + size / 2 - 320) * 0.5, 5);
      expect(compact[i][3]).toBe(size);
    });
  });

  it('changes blinking rhythm without changing the flight paths', () => {
    const ctx = contextSpy();
    const frames = (twinkleSpeed: number): number[] => {
      installConfig(ctx, { ...VISUALIZER_PRESETS[2], twinkleSpeed });
      return [0.5, 1, 1.5, 2, 2.5].map(time => {
        (component as any).time = time;
        ctx.drawImage.calls.reset();
        (component as any).render({ ...music(), beat: 0 });
        return ctx.drawImage.calls.count();
      });
    };
    expect(frames(0.5)).not.toEqual(frames(3));
  });

  function contextSpy(): jasmine.SpyObj<CanvasRenderingContext2D> {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>('canvas', [
      'setTransform', 'save', 'restore', 'translate', 'rotate', 'scale', 'clearRect',
      'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'arc', 'drawImage', 'createLinearGradient'
    ]);
    ctx.createLinearGradient.and.returnValue(jasmine.createSpyObj<CanvasGradient>('gradient', ['addColorStop']));
    return ctx;
  }

  function installConfig(ctx: CanvasRenderingContext2D, config: VisualizerConfig): void {
    (component as any).ctx = ctx;
    (component as any).width = 640;
    (component as any).height = 360;
    (component as any).config = service.normalizeConfig(config);
    (component as any).time = 0;
    (component as any).fireflyPreviousBeat = 0;
    (component as any).fireflyLastBeatAt = -Infinity;
  }

  function music() {
    return {
      source: 'tab' as const, level: 0.7, bass: 0.5, mids: 0.4, treble: 0.3, beat: 0.4,
      spectrum: new Array(64).fill(0.7)
    };
  }
});
