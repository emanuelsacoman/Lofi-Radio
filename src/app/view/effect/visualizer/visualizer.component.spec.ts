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

  it('accepts switching the active preset off', () => {
    expect(service.setPreset(null)).toBeTrue();
    expect(service.calculatePaths(1)).toEqual([]);
  });
});
