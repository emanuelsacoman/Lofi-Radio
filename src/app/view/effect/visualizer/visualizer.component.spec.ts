import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VisualizerComponent } from './visualizer.component';
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
