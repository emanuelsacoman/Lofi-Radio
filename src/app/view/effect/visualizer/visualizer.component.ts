import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input,
  NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { VisualizerService } from 'src/app/services/visualizer.service';
import { VisualizerConfig } from 'src/app/services/interfaces/visualizer/visualizerconfig';
import { VisualizerPath } from 'src/app/services/interfaces/visualizer/visualizerpoint';

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualizerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() playing = true;
  @ViewChild('canvas', { static: true }) canvasElement!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private config: VisualizerConfig | null = null;
  private subscription?: Subscription;
  private resizeObserver?: ResizeObserver;
  private frameId: number | null = null;
  private lastFrame = 0;
  private time = 0;
  private width = 0;
  private height = 0;
  private destroyed = false;
  private reducedMotion: MediaQueryList | null = null;
  private readonly visibilityHandler = () => this.syncAnimation();
  private readonly motionHandler = () => this.syncAnimation();

  constructor(private visualizer: VisualizerService, private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.ctx = this.canvasElement.nativeElement.getContext('2d', { alpha: true });
    if (!this.ctx) return;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion.addEventListener?.('change', this.motionHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvasElement.nativeElement);
    } else {
      window.addEventListener('resize', this.resize);
    }
    this.resize();
    this.subscription = this.visualizer.activeConfig$.subscribe(config => {
      this.config = config;
      this.syncAnimation();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playing'] && this.ctx) this.syncAnimation();
  }

  private readonly resize = (): void => {
    if (!this.ctx) return;
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    if (this.width <= 0 || this.height <= 0) return;

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(this.width * scale));
    const pixelHeight = Math.max(1, Math.round(this.height * scale));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    this.ctx.setTransform(canvas.width / this.width, 0, 0, canvas.height / this.height, 0, 0);
    this.render();
  };

  private syncAnimation(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.lastFrame = 0;
    if (!this.ctx || this.destroyed) return;
    this.render();
    if (!this.config || !this.playing || document.hidden || this.reducedMotion?.matches) return;
    this.zone.runOutsideAngular(() => {
      this.frameId = requestAnimationFrame(this.tick);
    });
  }

  private readonly tick = (timestamp: number): void => {
    this.frameId = null;
    if (this.destroyed || !this.config || !this.playing || document.hidden || this.reducedMotion?.matches) return;
    if (this.lastFrame) this.time += Math.min((timestamp - this.lastFrame) / 1000, 0.05);
    this.lastFrame = timestamp;
    this.render();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private render(): void {
    if (!this.ctx || this.width <= 0 || this.height <= 0) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const config = this.config;
    if (!config) return;
    const paths = this.visualizer.calculatePaths(this.time);
    const colorA = this.color(config.color, '--clr-primary', '#aea4d3');
    const colorB = this.color(config.secondaryColor, '--clr-accent', '#805cb1');
    for (const path of paths) {
      const blend = paths.length <= 1 ? 0 : path.layer / (paths.length - 1);
      ctx.strokeStyle = blend < 0.5 ? colorA : colorB;
      ctx.globalAlpha = Math.max(0.08, config.opacity * (1 - blend * 0.5));
      ctx.lineWidth = config.lineWidth * (1 - blend * 0.35);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = config.glow;
      if (path.kind === 'bar') this.drawBars(ctx, path, config.barCount);
      else this.drawCurve(ctx, path);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private drawCurve(ctx: CanvasRenderingContext2D, path: VisualizerPath): void {
    if (!path.points.length) return;
    ctx.beginPath();
    path.points.forEach((point, index) => {
      const x = point.x * this.width;
      const y = point.y * this.height;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (path.closed) ctx.closePath();
    ctx.stroke();
  }

  private drawBars(ctx: CanvasRenderingContext2D, path: VisualizerPath, barCount: number): void {
    ctx.lineWidth = Math.max(1, this.width / barCount * 0.55);
    ctx.beginPath();
    for (const point of path.points) {
      const x = point.x * this.width;
      const y = point.y * this.height;
      ctx.moveTo(x, this.height / 2 - (y - 0.5) * this.height);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private color(value: string, cssVariable: string, fallback: string): string {
    if (value !== 'theme' && value !== 'accent') return value;
    const key = value === 'theme' ? '--clr-primary' : '--clr-accent';
    return getComputedStyle(document.documentElement).getPropertyValue(key).trim()
      || getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim()
      || fallback;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription?.unsubscribe();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.reducedMotion?.removeEventListener?.('change', this.motionHandler);
  }
}
