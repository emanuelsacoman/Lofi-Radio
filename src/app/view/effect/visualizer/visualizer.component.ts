import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input,
  NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { VisualizerService } from 'src/app/services/visualizer.service';
import { VisualizerConfig } from 'src/app/services/interfaces/visualizer/visualizerconfig';
import { VisualizerPath } from 'src/app/services/interfaces/visualizer/visualizerpoint';
import { VisualizerAudioService } from 'src/app/services/visualizer-audio.service';
import {
  SILENT_AUDIO_FRAME, VisualizerAudioFrame
} from 'src/app/services/interfaces/visualizer/visualizer-audio-frame';


/** Fixed procedural seeds: visual patterns are reproducible, with no per-frame random allocations. */
interface AtmosphereSeed {
  x: number;
  y: number;
  phase: number;
  speed: number;
  size: number;
}

const TAU = Math.PI * 2;
const fraction = (value: number): number => value - Math.floor(value);
const ATMOSPHERE: ReadonlyArray<AtmosphereSeed> = Array.from({ length: 72 }, (_, i) => {
  const seed = i + 1;
  return {
    x: fraction(Math.sin(seed * 127.1) * 43758.5453),
    y: fraction(Math.sin(seed * 311.7) * 43758.5453),
    phase: fraction(Math.sin(seed * 74.7) * 43758.5453) * TAU,
    speed: 0.5 + fraction(Math.sin(seed * 91.3) * 43758.5453),
    size: 0.6 + fraction(Math.sin(seed * 45.2) * 43758.5453) * 1.8
  };
});

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualizerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() playing = true;
  @Input() palette = '';
  @ViewChild('canvas', { static: true }) canvasElement!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private config: VisualizerConfig | null = null;
  private subscription?: Subscription;
  private audioSubscription?: Subscription;
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

  constructor(private visualizer: VisualizerService, private zone: NgZone, private audio: VisualizerAudioService) {}

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
    this.audioSubscription = this.audio.status$.subscribe(() => this.syncAnimation());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['playing'] || changes['palette']) && this.ctx) this.syncAnimation();
  }

  private readonly resize = (): void => {
    if (!this.ctx) return;
    const canvas = this.canvasElement.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    if (this.width <= 0 || this.height <= 0) return;

    // Limit the framebuffer to ~4.5 MP on large/high-DPI screens.
    const scale = Math.min(window.devicePixelRatio || 1, 2,
      Math.sqrt(4_500_000 / Math.max(1, this.width * this.height)));
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
    // For reduced motion show a single audio-driven still instead of a blank canvas.
    this.render(this.audio.isActive ? this.audio.readFrame() : SILENT_AUDIO_FRAME);
    // Audio from the captured tab is authoritative; YouTube state may lag behind.
    if (!this.config || !this.audio.isActive || document.hidden || this.reducedMotion?.matches) return;
    this.zone.runOutsideAngular(() => {
      this.frameId = requestAnimationFrame(this.tick);
    });
  }

  private readonly tick = (timestamp: number): void => {
    this.frameId = null;
    if (this.destroyed || !this.config || !this.audio.isActive || document.hidden || this.reducedMotion?.matches) return;
    // A 45 FPS ceiling leaves CPU/GPU headroom for YouTube, audio and the page.
    if (this.lastFrame && timestamp - this.lastFrame < 1000 / 45) {
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }
    const frame = this.audio.readFrame();
    // No real signal means no prerecorded looping animation.
    if (this.lastFrame) {
      const dt = Math.min((timestamp - this.lastFrame) / 1000, 0.05);
      this.time += dt * Math.min(3, frame.level * 1.7 + frame.bass * 1.1 + frame.beat * 0.6);
    }
    this.lastFrame = timestamp;
    this.render(frame);
    this.frameId = requestAnimationFrame(this.tick);
  };

  private render(audio: VisualizerAudioFrame = SILENT_AUDIO_FRAME): void {
    if (!this.ctx || this.width <= 0 || this.height <= 0) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const config = this.config;
    if (!config) return;

    // An actual FFT signal is the only source of light and motion.
    const activity = this.visualizer.getAudioActivity(audio);
    if (activity <= 0) return;

    const paths = this.visualizer.calculatePaths(this.time, undefined, audio);
    const main = this.color(config.color, '--clr-primary', '#aea4d3');
    const accent = this.color(config.secondaryColor, '--clr-accent', '#805cb1');
    const minSide = Math.min(this.width, this.height);
    const style = config.visualStyle;

    ctx.globalCompositeOperation = 'lighter';
    if (style === 'silk' || style === 'fireflies') {
      this.drawAuroraVeils(ctx, audio, activity, main, accent);
    }

    for (const path of paths) {
      const blend = paths.length <= 1 ? 0 : path.layer / (paths.length - 1);
      const color = blend < 0.5 ? main : accent;
      const quietUnderlay = style === 'fireflies' || style === 'meteor';
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(0.95, config.opacity *
        (quietUnderlay ? 0.26 : 0.64) * (1 - blend * 0.36) *
        activity * (0.65 + audio.level * 0.35 + audio.beat * 0.18));
      ctx.lineWidth = config.lineWidth * (1 - blend * 0.25) * (1 + audio.beat * 0.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = config.glow * (0.8 + audio.beat * 0.6);
      if (path.kind === 'bar') this.drawBars(ctx, path, config.barCount);
      else this.drawCurve(ctx, path);
    }

    switch (style) {
      case 'orbit':
        this.drawOrbitLights(ctx, audio, activity, main, accent, minSide);
        break;
      case 'vortex':
        this.drawVortexDust(ctx, audio, activity, main, accent);
        break;
      case 'bars':
        this.drawSpectrumSparks(ctx, paths[0], audio, activity, accent);
        break;
      case 'constellation':
        this.drawConstellation(ctx, paths[0], audio, activity, main, accent);
        break;
      case 'fireflies':
        this.drawFireflies(ctx, audio, activity, main, accent);
        break;
      case 'meteor':
        this.drawMeteorShower(ctx, audio, activity, main, accent);
        break;
      case 'lotus':
        this.drawLotus(ctx, audio, activity, main, accent, minSide);
        break;
      default:
        // Silk already has three translucent aurora curtains.
        break;
    }

    // Do not leak additive blending or shadows into other canvas consumers.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private drawAuroraVeils(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    if (typeof ctx.fill !== 'function') return;
    const steps = this.width < 640 ? 32 : 64;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = u * this.width;
        const envelope = Math.sin(Math.PI * u);
        const swell = Math.sin(u * TAU * (1.25 + layer * 0.35) +
          this.time * (0.28 + layer * 0.05) + layer * 1.5);
        const y = this.height * (0.43 + layer * 0.055) +
          swell * this.height * (0.035 + audio.bass * 0.075) * envelope * activity;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(this.width, this.height * 0.86);
      ctx.lineTo(0, this.height * 0.86);
      ctx.closePath();
      const gradient = typeof ctx.createLinearGradient === 'function'
        ? ctx.createLinearGradient(0, this.height * 0.35, 0, this.height * 0.86)
        : null;
      if (gradient) {
        gradient.addColorStop(0, layer % 2 === 0 ? main : accent);
        gradient.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = gradient || (layer % 2 === 0 ? main : accent);
      ctx.globalAlpha = 0.11 * activity * (1 + audio.bass * 0.3);
      ctx.shadowBlur = 0;
      ctx.fill();
    }
  }

  private drawOrb(
    ctx: CanvasRenderingContext2D, x: number, y: number,
    radius: number, color: string, alpha: number, blur: number
  ): void {
    if (typeof ctx.arc !== 'function' || typeof ctx.fill !== 'function') return;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.25, radius), 0, TAU);
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fill();
  }

  private drawOrbitLights(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string, side: number
  ): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = side * (0.22 + audio.bass * 0.025) * activity;
    if (typeof ctx.arc === 'function') {
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (0.7 + ring * 0.25), 0, TAU);
        ctx.strokeStyle = ring % 2 ? accent : main;
        ctx.globalAlpha = (0.06 + audio.bass * 0.07) * activity;
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 15;
        ctx.stroke();
      }
    }
    for (let i = 0; i < 20; i++) {
      const angle = i * TAU / 20 + this.time * (0.06 + (i % 3) * 0.012);
      const r = radius * (0.8 + (i % 4) * 0.1);
      this.drawOrb(ctx, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r,
        1.1 + audio.treble * 2.6 + (i % 3) * 0.4,
        i % 2 ? accent : main, activity * (0.26 + audio.treble * 0.45), 9);
    }
  }

  private drawVortexDust(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    const side = Math.min(this.width, this.height);
    const count = this.width < 640 ? 34 : 66;
    for (let i = 0; i < count; i++) {
      const seed = ATMOSPHERE[i];
      const depth = Math.sqrt(seed.y);
      const angle = seed.phase + this.time * (0.12 + seed.speed * 0.10) + depth * TAU;
      const radius = side * (0.035 + depth * 0.46) * activity;
      this.drawOrb(ctx,
        this.width / 2 + Math.cos(angle) * radius,
        this.height / 2 + Math.sin(angle) * radius,
        seed.size * (0.6 + audio.treble * 0.75),
        i % 4 === 0 ? accent : main,
        activity * (0.10 + audio.mids * 0.33) * (1 - depth * 0.4),
        10 + audio.beat * 12);
    }
  }

  private drawSpectrumSparks(
    ctx: CanvasRenderingContext2D, path: VisualizerPath | undefined,
    audio: VisualizerAudioFrame, activity: number, accent: string
  ): void {
    if (!path) return;
    const step = this.width < 640 ? 3 : 2;
    for (let i = 0; i < path.points.length; i += step) {
      const point = path.points[i];
      const bin = audio.spectrum[Math.min(audio.spectrum.length - 1,
        Math.floor(i / path.points.length * audio.spectrum.length))] || 0;
      if (bin < 0.08 || point.y >= 0.98) continue;
      this.drawOrb(ctx, point.x * this.width, point.y * this.height,
        1 + audio.beat * 2 + bin * 2, accent,
        activity * bin * (0.36 + audio.beat * 0.35), 13);
    }
  }

  private drawConstellation(
    ctx: CanvasRenderingContext2D, path: VisualizerPath | undefined,
    audio: VisualizerAudioFrame, activity: number, main: string, accent: string
  ): void {
    if (!path) return;
    const step = this.width < 640 ? 25 : 16;
    for (let i = 0; i < path.points.length; i += step) {
      const p = path.points[i];
      this.drawOrb(ctx, p.x * this.width, p.y * this.height,
        1 + audio.treble * 2.5 + (i % 5) * 0.18,
        i % 3 === 0 ? accent : main,
        activity * (0.26 + audio.treble * 0.62), 12);
    }
  }

  private drawFireflies(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    const count = this.width < 640 ? 32 : 58;
    for (let i = 0; i < count; i++) {
      const seed = ATMOSPHERE[i];
      const driftX = Math.sin(seed.phase + this.time * seed.speed * 0.17) * 0.08;
      const driftY = Math.cos(seed.phase + this.time * seed.speed * 0.12) * 0.06;
      const x = fraction(seed.x + driftX) * this.width;
      const y = fraction(seed.y + driftY) * this.height;
      const shimmer = 0.5 + 0.5 * Math.sin(this.time * (0.35 + seed.speed) + seed.phase);
      this.drawOrb(ctx, x, y,
        seed.size * (1 + audio.treble * 0.6) + shimmer,
        i % 3 === 0 ? main : accent,
        activity * (0.11 + shimmer * 0.36 + audio.beat * 0.14),
        14 + shimmer * 15);
    }
  }

  private drawMeteorShower(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    const count = this.width < 640 ? 24 : 44;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const seed = ATMOSPHERE[i];
      const bin = audio.spectrum[i % Math.max(1, audio.spectrum.length)] || 0;
      const progress = fraction(seed.y + this.time * (0.035 + seed.speed * 0.04));
      const x = fraction(seed.x + progress * 0.18) * this.width;
      const y = progress * this.height;
      const trail = (14 + 55 * bin + 22 * audio.beat) * (this.width < 640 ? 0.7 : 1);
      const color = i % 3 === 0 ? accent : main;
      ctx.beginPath();
      ctx.moveTo(x - trail * 0.34, y - trail);
      ctx.lineTo(x, y);
      ctx.lineWidth = 0.65 + 2 * bin;
      ctx.strokeStyle = color;
      ctx.globalAlpha = activity * (0.08 + bin * 0.42);
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + 15 * bin;
      ctx.stroke();
      if (bin > 0.24) {
        this.drawOrb(ctx, x, y, 0.8 + bin * 1.8, accent,
          activity * (0.15 + bin * 0.45), 12);
      }
    }
  }

  private drawLotus(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string, side: number
  ): void {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const bloom = side * (0.13 + audio.bass * 0.055) * activity;
    for (let ring = 0; ring < 2; ring++) {
      const petals = ring === 0 ? 12 : 8;
      const outer = bloom * (ring === 0 ? 1.55 : 0.9);
      const inner = bloom * (ring === 0 ? 0.47 : 0.2);
      ctx.strokeStyle = ring ? accent : main;
      ctx.globalAlpha = activity * (0.3 + audio.mids * 0.42);
      ctx.lineWidth = 1.1 + audio.beat * 1.2;
      ctx.shadowColor = ring ? accent : main;
      ctx.shadowBlur = 16 + audio.beat * 12;
      for (let petal = 0; petal < petals; petal++) {
        ctx.beginPath();
        for (let step = 0; step <= 24; step++) {
          const u = step / 24;
          const theta = (petal + u) * TAU / petals + this.time * (ring ? -0.045 : 0.03);
          const r = inner + (outer - inner) * Math.pow(Math.sin(Math.PI * u), 1.15);
          const x = cx + Math.cos(theta) * r;
          const y = cy + Math.sin(theta) * r;
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    this.drawOrb(ctx, cx, cy, 3 + audio.beat * 4,
      accent, activity * (0.48 + audio.bass * 0.35), 22);
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
      // A bar starts at the bottom and only grows upwards.
      ctx.moveTo(x, this.height);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private color(value: string, cssVariable: string, fallback: string): string {
    if (value.startsWith('#')) return value;
    const variables: Record<string, string> = {
      theme: '--clr-primary',
      secondary: '--clr-secondary',
      accent: '--clr-accent',
      accentLight: '--clr-accent-light',
      text: '--clr-text'
    };
    const key = variables[value] ?? cssVariable;
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(key).trim()
      || style.getPropertyValue(cssVariable).trim() || fallback;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription?.unsubscribe();
    this.audioSubscription?.unsubscribe();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.reducedMotion?.removeEventListener?.('change', this.motionHandler);
  }
}
