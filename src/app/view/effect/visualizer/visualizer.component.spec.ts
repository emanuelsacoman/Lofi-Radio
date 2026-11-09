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

  it('accepts switching the active preset off', () => {
    expect(service.setPreset(null)).toBeTrue();
    expect(service.calculatePaths(1)).toEqual([]);
  });
});
