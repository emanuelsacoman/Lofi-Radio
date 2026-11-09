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

  it('draws distinct atmospheres for the three new presets without needing new browser permissions', () => {
    const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>(
      'CanvasRenderingContext2D',
      ['clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath',
       'stroke', 'arc', 'fill', 'createLinearGradient']
    );
    const gradient = jasmine.createSpyObj<CanvasGradient>('CanvasGradient', ['addColorStop']);
    ctx.createLinearGradient.and.returnValue(gradient);
    (component as any).ctx = ctx;
    (component as any).width = 1280;
    (component as any).height = 720;
    const realAudio = {
      source: 'tab' as const,
      level: 0.75, bass: 0.8, mids: 0.65, treble: 0.6, beat: 0.9,
      spectrum: new Array(64).fill(0.8)
    };

    for (const id of ['moonlit-fireflies', 'neon-meteor-rain', 'lotus-dream']) {
      expect(service.setPreset(id)).toBeTrue();
      ctx.fill.calls.reset();
      ctx.stroke.calls.reset();
      (component as any).render(realAudio);
      expect(ctx.stroke.calls.count()).toBeGreaterThan(0);
      expect(ctx.fill.calls.count()).toBeGreaterThan(0);
      expect(ctx.globalCompositeOperation).toBe('source-over');
      expect(ctx.globalAlpha).toBe(1);
      expect(ctx.shadowBlur).toBe(0);
    }
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
    expect(ctx.clearRect).toHaveBeenCalledTimes(service.getPresets().length);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('accepts switching the active preset off', () => {
    expect(service.setPreset(null)).toBeTrue();
    expect(service.calculatePaths(1)).toEqual([]);
  });
});
