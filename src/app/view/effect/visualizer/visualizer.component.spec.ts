import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisualizerComponent, fireflyAudioResponse } from './visualizer.component';
import { VisualizerService } from 'src/app/services/visualizer.service';

describe('VisualizerComponent', () => {
  let component: VisualizerComponent;
  let fixture: ComponentFixture<VisualizerComponent>;
  let service: VisualizerService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ declarations: [VisualizerComponent] });
    fixture = TestBed.createComponent(VisualizerComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(VisualizerService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });

  it('creates a canvas', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
  });

  it('renders captured audio even if the YouTube playing flag is temporarily false', () => {
    service.setPreset('pulse-bars');
    component.playing = false;

    // Render against a mock canvas to test the drawing gate independently
    // of browser permissions and the visible dimensions of the test fixture.
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke']
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
      ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke']
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

  it('keeps every firefly exactly the same size during bass drops', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D', ['clearRect', 'drawImage']
    );
    (component as any).ctx = ctx;
    (component as any).width = 1280;
    (component as any).height = 720;
    service.setPreset('moonlit-fireflies');

    const quiet = {
      source: 'tab' as const,
      level: 0.05, bass: 0.04, mids: 0.08, treble: 0.02, beat: 0,
      spectrum: new Array(64).fill(0.02)
    };
    (component as any).render(quiet);
    const sizesBefore = ctx.drawImage.calls.allArgs().map(args => [args[3], args[4]]);
    expect(sizesBefore.length).toBe(18);

    ctx.drawImage.calls.reset();
    (component as any).render({
      ...quiet, level: 0.7, bass: 0.8, mids: 0.5, treble: 0.6, beat: 1,
      spectrum: new Array(64).fill(0.8)
    });
    const sizesAfter = ctx.drawImage.calls.allArgs().map(args => [args[3], args[4]]);
    expect(sizesAfter).toEqual(sizesBefore);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.shadowBlur).toBe(0);
  });

  it('renders Firefly with cached glow sprites and without blurred strokes', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
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

    expect(ctx.drawImage).toHaveBeenCalledTimes(18);
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.globalCompositeOperation).toBe('source-over');

    const cachedSprites = (component as any).fireflySprites;
    expect(cachedSprites).toBeTruthy();
    (component as any).render(audio);
    expect(ctx.drawImage).toHaveBeenCalledTimes(36);
    expect((component as any).fireflySprites).toBe(cachedSprites);
  });

  it('renders fewer Firefly sprites on narrow screens', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D', ['clearRect', 'drawImage']
    );
    (component as any).ctx = ctx;
    (component as any).width = 390;
    (component as any).height = 700;
    service.setPreset('moonlit-fireflies');
    (component as any).render({
      source: 'tab', level: 0.7, bass: 0.4, mids: 0.5, treble: 0.4, beat: 0.5,
      spectrum: new Array(64).fill(0.5)
    });
    expect(ctx.drawImage).toHaveBeenCalledTimes(11);
  });

  it('keeps every atmosphere completely dark in genuine silence, even with beat decay', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'arc', 'fill']
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
  });
});
