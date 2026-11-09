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
const ATMOSPHERE: ReadonlyArray<AtmosphereSeed> = Array.from({ length: 18 }, (_, i) => {
  const seed = i + 1;
  return {
    x: fraction(Math.sin(seed * 127.1) * 43758.5453),
    y: fraction(Math.sin(seed * 311.7) * 43758.5453),
    phase: fraction(Math.sin(seed * 74.7) * 43758.5453) * TAU,
    speed: 0.5 + fraction(Math.sin(seed * 91.3) * 43758.5453),
    size: 0.6 + fraction(Math.sin(seed * 45.2) * 43758.5453) * 1.8
  };
});

/** Cheap, deterministic music-to-light modulation. Beat comes from the analyser's
 * decay envelope; without genuine tab audio there is no light or movement. */
export function fireflyAudioResponse(
  audio: VisualizerAudioFrame, spectrumBand: number, activity: number
): { scale: number; alpha: number; expansion: number } {
  const bounded = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  if (audio.source !== 'tab' || activity <= 0) {
    return { scale: 0, alpha: 0, expansion: 0 };
  }
  const beat = bounded(audio.beat);
  const bass = Math.sqrt(bounded(audio.bass));
  const level = Math.sqrt(bounded(audio.level));
  const mids = Math.sqrt(bounded(audio.mids));
  const sparkle = Math.sqrt(bounded(bounded(audio.treble) * 0.5 + bounded(spectrumBand) * 0.5));
  const pulse = bounded(0.42 * bass + 0.33 * level + 0.18 * mids + 0.58 * beat);

  return {
    // Visible swell on bass transients, with independent twinkles per FFT bin.
    scale: 0.78 + 0.95 * pulse + 0.42 * sparkle,
    alpha: bounded(bounded(activity) * (0.22 + 0.45 * pulse + 0.30 * sparkle)),
    expansion: 0.075 * pulse + 0.12 * beat
  };
}

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
  // Tiny pre-rendered light textures. Rebuild only when the palette changes.
  private fireflySprites: { key: string; main: HTMLCanvasElement; accent: HTMLCanvasElement } | null = null;
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
      const wasFirefly = this.config?.visualStyle === 'fireflies';
      this.config = config;
      // Firefly uses a smaller framebuffer; restore normal resolution on exit.
      if (wasFirefly !== (config?.visualStyle === 'fireflies')) this.resize();
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
    // Firefly is deliberately lower-resolution: its diffuse light needs no
    // per-pixel sharpness and large backing buffers are expensive to clear.
    const firefly = this.config?.visualStyle === 'fireflies';
    const pixelBudget = firefly ? 1_400_000 : 4_500_000;
    const scale = Math.min(window.devicePixelRatio || 1, firefly ? 1 : 2,
      Math.sqrt(pixelBudget / Math.max(1, this.width * this.height)));
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
    // Firefly needs gentle motion, not 45 blurred frames every second.
    const frameInterval = this.config.visualStyle === 'fireflies' ? 1000 / 24 : 1000 / 45;
    if (this.lastFrame && timestamp - this.lastFrame < frameInterval) {
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

    const main = this.color(config.color, '--clr-primary', '#aea4d3');
    const accent = this.color(config.secondaryColor, '--clr-accent', '#805cb1');
    const style = config.visualStyle;

    if (style === 'fireflies') {
      // No wave geometry, translucent full-screen veils, per-particle blur or
      // additive whole-screen compositing; only small cached sprite blits.
      this.drawFireflies(ctx, audio, activity, main, accent);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      return;
    }

    const paths = this.visualizer.calculatePaths(this.time, undefined, audio);

    ctx.globalCompositeOperation = 'lighter';
    if (style === 'silk') {
      this.drawAuroraVeils(ctx, audio, activity, main, accent);
    }

    for (const path of paths) {
      const blend = paths.length <= 1 ? 0 : path.layer / (paths.length - 1);
      const color = blend < 0.5 ? main : accent;
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(0.95, config.opacity *
        0.64 * (1 - blend * 0.36) *
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
      case 'bars':
        this.drawSpectrumSparks(ctx, paths[0], audio, activity, accent);
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

  /** Renders the costly radial glow once per palette, not once per particle/frame. */
  private fireflySprite(color: string): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const sprite = document.createElement('canvas');
    sprite.width = 40;
    sprite.height = 40;
    const paint = sprite.getContext('2d');
    if (!paint) return null;
    const glow = paint.createRadialGradient(20, 20, 0, 20, 20, 20);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    glow.addColorStop(0.12, color);
    glow.addColorStop(0.32, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    paint.fillStyle = glow;
    paint.fillRect(0, 0, 40, 40);
    return sprite;
  }

  private drawFireflies(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    const key = main + '|' + accent;
    if (this.fireflySprites?.key !== key) {
      const primary = this.fireflySprite(main);
      const secondary = this.fireflySprite(accent);
      this.fireflySprites = primary && secondary
        ? { key, main: primary, accent: secondary } : null;
    }
    const sprites = this.fireflySprites;
    if (!sprites || typeof ctx.drawImage !== 'function') return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    const count = this.width < 640 ? 11 : 18;
    // Stable seeds keep the composition calm while motion stays audio-driven.
    for (let i = 0; i < count; i++) {
      const seed = ATMOSPHERE[i];
      const driftX = Math.sin(seed.phase + this.time * seed.speed * 0.17) * 0.025;
      const driftY = Math.cos(seed.phase + this.time * seed.speed * 0.12) * 0.03;
      // Spread the sound across fireflies: each reacts to a different FFT band.
      const bandIndex = audio.spectrum.length ? (i * 7 + 3) % audio.spectrum.length : 0;
      const reaction = fireflyAudioResponse(audio, audio.spectrum[bandIndex] ?? 0, activity);
      const x = (seed.x + driftX + (seed.x - 0.5) * reaction.expansion) * this.width;
      const y = (seed.y + driftY + (seed.y - 0.5) * reaction.expansion) * this.height;
      const shimmer = 0.85 + 0.15 * Math.sin(this.time * (0.35 + seed.speed) + seed.phase);
      const size = (13 + seed.size * 4) * reaction.scale;
      ctx.globalAlpha = reaction.alpha * shimmer;
      ctx.drawImage(i % 3 === 0 ? sprites.main : sprites.accent,
        x - size / 2, y - size / 2, size, size);
    }
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
    this.fireflySprites = null;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.reducedMotion?.removeEventListener?.('change', this.motionHandler);
  }
}
