import { Component } from '@angular/core';
import { VisualizerService } from 'src/app/services/visualizer.service';
<<<<<<< Updated upstream
=======
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
  depth: number;
}

const TAU = Math.PI * 2;
const fraction = (value: number): number => value - Math.floor(value);
const ATMOSPHERE: ReadonlyArray<AtmosphereSeed> = Array.from({ length: 96 }, (_, i) => {
  const seed = i + 1;
  return {
    x: fraction(Math.sin(seed * 127.1) * 43758.5453),
    y: fraction(Math.sin(seed * 311.7) * 43758.5453),
    phase: fraction(Math.sin(seed * 74.7) * 43758.5453) * TAU,
    speed: 0.5 + fraction(Math.sin(seed * 91.3) * 43758.5453),
    size: 0.6 + fraction(Math.sin(seed * 45.2) * 43758.5453) * 1.8,
    depth: 0.55 + fraction(Math.sin(seed * 25.9) * 43758.5453) * 0.45
  };
});

/** A smooth flash with dark gaps; no objects or closures per particle/frame. */
function fireflyFlash(cycle: number, start: number, duration: number): number {
  const progress = (cycle - start) / duration;
  if (progress <= 0 || progress >= 1) return 0;
  const intensity = Math.sin(Math.PI * progress);
  return intensity * intensity;
}

/** A gentle, bounded flight path made of different frequencies.
 * It is not driven by the beat: fireflies wander naturally at constant size. */
export function fireflyFlight(seed: AtmosphereSeed, seconds: number): { x: number; y: number } {
  const t = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const drift = t * seed.speed * seed.depth;
  const x = 0.10 + seed.x * 0.80
    + 0.028 * Math.sin(seed.phase + drift * 0.20)
    + 0.012 * Math.sin(seed.phase * 1.7 - drift * 0.47);
  const y = 0.15 + seed.y * 0.69
    + 0.027 * Math.cos(seed.phase * 0.8 + drift * 0.16)
    + 0.013 * Math.sin(seed.phase * 1.3 + drift * 0.35);
  return { x, y };
}

/** A brief, staggered answer to a real detected beat. Four lights answer in
 * sequence instead of the entire garden flashing in sync. */
export function fireflyEcho(secondsSinceBeat: number, index: number): number {
  if (index % 5 !== 0 || !Number.isFinite(secondsSinceBeat)) return 0;
  const delay = Math.floor(index / 5) * 0.15;
  const elapsed = secondsSinceBeat - delay;
  if (elapsed <= 0 || elapsed >= 0.31) return 0;
  const intensity = Math.sin(Math.PI * elapsed / 0.31);
  return intensity * intensity * 0.78;
}


/** Deterministic asynchronous flashes: fixed-size fireflies spend most of
 * their time dark and briefly light up on individual staggered schedules.
 * Actual shared audio controls brightness, while the existing analyser still
 * controls whether any firefly may appear at all. No per-frame allocations. */
export function fireflyAudioResponse(
  audio: VisualizerAudioFrame,
  spectrumBand: number,
  activity: number,
  seconds: number,
  phase: number,
  speed: number,
  echo = 0
): { alpha: number } {
  const clamp = (n: number): number =>
    Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  if (audio.source !== 'tab' || activity <= 0) return { alpha: 0 };

  // Each seeded firefly has a different period and offset. Most of the cycle
  // remains dark; a few emit a smaller second flash as real fireflies do.
  const period = 2.4 + clamp(speed / 1.5) * 2.2;
  const cycle = fraction(Math.max(0, seconds) / period + phase / TAU);
  const first = fireflyFlash(cycle, 0.04, 0.14);
  const doubleFlash = phase > Math.PI ? fireflyFlash(cycle, 0.25, 0.11) * 0.65 : 0;
  const blink = Math.max(first, doubleFlash, Math.max(0, Math.min(1, echo)));

  // Music colors an individual flash; a detected beat invites a short,
  // staggered answer. Neither music nor a flash can resize the light.
  const energy = clamp(
    0.33 * clamp(audio.bass) +
    0.24 * clamp(audio.level) +
    0.20 * clamp(audio.treble) +
    0.15 * clamp(spectrumBand) +
    0.20 * clamp(audio.beat)
  );
  return { alpha: clamp(clamp(activity) * blink * (0.56 + 0.44 * energy)) };
}
>>>>>>> Stashed changes

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.css'],
})
<<<<<<< Updated upstream
export class VisualizerComponent {
  
  constructor(private visualizerService: VisualizerService) {}

  
=======
export class VisualizerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() playing = true;
  @Input() palette = '';
  @Input() previewMode = false;
  @Input() previewConfig: VisualizerConfig | null = null;
  @ViewChild('canvas', { static: true }) canvasElement!: ElementRef<HTMLCanvasElement>;

  private ctx: CanvasRenderingContext2D | null = null;
  private config: VisualizerConfig | null = null;
  private subscription?: Subscription;
  private audioSubscription?: Subscription;
  private resizeObserver?: ResizeObserver;
  private frameId: number | null = null;
  private lastFrame = 0;
  private time = 0;
  private readonly previewSpectrum = new Array<number>(64).fill(0);
  private readonly previewAudio: VisualizerAudioFrame = {
    source: 'tab', level: 0, bass: 0, mids: 0, treble: 0, beat: 0,
    spectrum: this.previewSpectrum
  };
  private width = 0;
  private height = 0;
  private destroyed = false;
  private reducedMotion: MediaQueryList | null = null;
  // Tiny pre-rendered light textures. Rebuild only when the palette changes.
  private fireflySprites: { key: string; main: HTMLCanvasElement; accent: HTMLCanvasElement } | null = null;
  private fireflyPreviousBeat = 0;
  private fireflyLastBeatAt = -Infinity;
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
    if (this.previewMode) {
      this.config = this.previewConfig ? this.visualizer.normalizeConfig(this.previewConfig) : null;
    }
    this.resize();
    this.subscription = this.visualizer.activeConfig$.subscribe(config => {
      if (!this.previewMode) this.setConfig(config);
    });
    this.audioSubscription = this.audio.status$.subscribe(() => this.syncAnimation());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['previewMode'] || changes['previewConfig']) {
      this.setConfig(this.previewMode ? this.previewConfig : this.visualizer.activeConfig);
    }
    if ((changes['playing'] || changes['palette']) && this.ctx) this.syncAnimation();
  }

  private setConfig(config: VisualizerConfig | null): void {
    const wasFirefly = this.config?.visualStyle === 'fireflies';
    this.config = config ? this.visualizer.normalizeConfig(config) : null;
    if (wasFirefly !== (config?.visualStyle === 'fireflies')) {
      this.fireflyPreviousBeat = 0;
      this.fireflyLastBeatAt = -Infinity;
      this.resize();
    }
    this.syncAnimation();
  }

  /** Demo data is confined to an explicitly enabled studio preview. No capture occurs. */
  private readFrame(): VisualizerAudioFrame {
    if (!this.previewMode) return this.audio.isActive ? this.audio.readFrame() : SILENT_AUDIO_FRAME;
    const t = this.time;
    const beat = Math.pow(Math.max(0, Math.cos(t * Math.PI * 2 * 0.9)), 8);
    for (let i = 0; i < this.previewSpectrum.length; i++) {
      const u = i / this.previewSpectrum.length;
      this.previewSpectrum[i] = Math.min(0.95,
        0.18 + (0.24 + Math.sin(i * 0.38 - t * 1.6) * 0.16) * (1 - u * 0.4) +
        beat * 0.32 * (1 - u) + Math.sin(i * 0.11 + t * 0.8) * 0.09);
    }
    this.previewAudio.level = 0.45 + beat * 0.15;
    this.previewAudio.bass = 0.42 + beat * 0.3;
    this.previewAudio.mids = 0.4 + Math.sin(t * 0.7) * 0.13;
    this.previewAudio.treble = 0.28 + Math.cos(t * 0.9) * 0.09;
    this.previewAudio.beat = beat;
    return this.previewAudio;
  }

  private get canAnimate(): boolean {
    return this.previewMode ? this.playing : this.audio.isActive;
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
    this.render(this.readFrame());
  };

  private syncAnimation(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.lastFrame = 0;
    if (!this.ctx || this.destroyed) return;
    // For reduced motion show a single audio-driven still instead of a blank canvas.
    this.render(this.readFrame());
    // Audio from the captured tab is authoritative; YouTube state may lag behind.
    if (!this.config || !this.canAnimate || document.hidden || this.reducedMotion?.matches) return;
    this.zone.runOutsideAngular(() => {
      this.frameId = requestAnimationFrame(this.tick);
    });
  }

  private readonly tick = (timestamp: number): void => {
    this.frameId = null;
    if (this.destroyed || !this.config || !this.canAnimate || document.hidden || this.reducedMotion?.matches) return;
    // Firefly needs gentle motion, not 45 blurred frames every second.
    const frameInterval = this.config.visualStyle === 'fireflies' ? 1000 / 24 : 1000 / 45;
    if (this.lastFrame && timestamp - this.lastFrame < frameInterval) {
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }
    const frame = this.readFrame();
    // No real signal means no prerecorded looping animation.
    if (this.lastFrame) {
      const dt = Math.min((timestamp - this.lastFrame) / 1000, 0.05);
      // Vagalumes mantêm seu relógio natural; música dá leve aceleração aos
      // ciclos de piscada, sem zoom e sem deslocamentos bruscos por batida.
      this.time += this.config.visualStyle === 'fireflies'
        ? dt * (0.90 + Math.min(0.35, frame.level * 0.25 + frame.treble * 0.18))
        : dt * Math.min(3, frame.level * 1.7 + frame.bass * 1.1 + frame.beat * 0.6);
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

    // Production uses captured FFT; only the explicit studio preview uses demo data.
    const activity = this.visualizer.getAudioActivity(audio);
    if (activity <= 0) return;

    const main = this.color(config.color, '--clr-primary', '#aea4d3');
    const accent = config.colorMode === 'solid'
      ? main : this.color(config.secondaryColor, '--clr-accent', '#805cb1');
    const style = config.visualStyle;

    // Keep positioning relative to the viewport and restore its pixel-ratio
    // transform after every frame. Clearing above always covers the whole canvas.
    ctx.save();
    ctx.translate(this.width * (0.5 + (config.positionX ?? 0) / 100),
      this.height * (0.5 + (config.positionY ?? 0) / 100));
    ctx.rotate((config.angle ?? 0) * Math.PI / 180);
    ctx.scale((config.scale ?? 1) * (config.mirrorX ? -1 : 1), config.scale ?? 1);
    ctx.translate(-this.width / 2, -this.height / 2);

    try {
    if (style === 'fireflies') {
      // No wave geometry, translucent full-screen veils, per-particle blur or
      // additive whole-screen compositing; only small cached sprite blits.
      this.drawFireflies(ctx, audio, activity, main, accent);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      return;
    }

    const paths = this.visualizer.calculatePathsForConfig(config, this.time, undefined, audio);
    const strokeGradient = config.colorMode === 'gradient'
      ? ctx.createLinearGradient(0, 0, this.width, this.height) : null;
    if (strokeGradient) {
      strokeGradient.addColorStop(0, main);
      strokeGradient.addColorStop(1, accent);
    }

    ctx.globalCompositeOperation = 'lighter';
    if (style === 'silk') {
      this.drawAuroraVeils(ctx, audio, activity, main, accent);
    }

    for (const path of paths) {
      const blend = paths.length <= 1 ? 0 : path.layer / (paths.length - 1);
      const color = blend < 0.5 ? main : accent;
      ctx.strokeStyle = strokeGradient || color;
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
    } finally {
      ctx.restore();
    }
  }

  private drawAuroraVeils(
    ctx: CanvasRenderingContext2D, audio: VisualizerAudioFrame,
    activity: number, main: string, accent: string
  ): void {
    if (typeof ctx.fill !== 'function' || this.config?.veilOpacity === 0) return;
    const steps = this.width < 640 ? 32 : 64;
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = u * this.width;
        const envelope = Math.sin(Math.PI * u);
        const swell = Math.sin(u * TAU * (1.25 + layer * 0.35) *
          ((this.config?.frequency ?? 3.2) / 3.2) +
          this.time * (0.28 + layer * 0.05) * ((this.config?.speed ?? 0.35) / 0.35) + layer * 1.5);
        const y = this.height * (0.43 + layer * 0.055) +
          swell * this.height * (0.035 + audio.bass * 0.075) * envelope * activity *
          ((this.config?.amplitude ?? 45) / 45);
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
        if (this.config?.colorMode === 'gradient') gradient.addColorStop(0.5, accent);
        gradient.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = gradient || (layer % 2 === 0 ? main : accent);
      ctx.globalAlpha = 0.11 * activity * (1 + audio.bass * 0.3) *
        ((this.config?.opacity ?? 0.82) / 0.82) * (this.config?.veilOpacity ?? 1);
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
      const endpoints = this.barEndpoints(point.y);
      this.drawOrb(ctx, point.x * this.width, endpoints.end,
        1 + audio.beat * 2 + bin * 2, accent,
        activity * bin * (0.36 + audio.beat * 0.35) * (this.config?.opacity ?? 0.85), 13);
      if (this.config?.barLayout === 'center') {
        this.drawOrb(ctx, point.x * this.width, endpoints.start,
          1 + audio.beat * 2 + bin * 2, accent,
          activity * bin * (0.36 + audio.beat * 0.35) * (this.config?.opacity ?? 0.85), 13);
      }
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
    // Tiny ivory-white core surrounded by a soft theme-colored halo.
    // Rendered only on palette changes, never per frame.
    const glow = paint.createRadialGradient(20, 20, 0, 20, 20, 20);
    glow.addColorStop(0, 'rgba(255, 255, 245, 1)');
    glow.addColorStop(0.065, 'rgba(255, 255, 245, 0.94)');
    glow.addColorStop(0.16, color);
    glow.addColorStop(0.39, color);
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
    // Density is an artistic choice, including on mobile; the cached textures,
    // reduced framebuffer and 24 fps cap bound the cost of the maximum 96 lights.
    const count = Math.min(ATMOSPHERE.length, Math.max(4, this.config?.particleCount ?? 18));
    const twinkleSpeed = this.config?.twinkleSpeed ?? 1;

    // A real new onset starts one tiny conversation between four of the
    // fireflies. ReadFrame's beat envelope decays, so detect a rising edge.
    if (audio.beat > 0.88 && audio.beat > this.fireflyPreviousBeat + 0.10 &&
        this.time - this.fireflyLastBeatAt > 0.32) {
      this.fireflyLastBeatAt = this.time;
    }
    this.fireflyPreviousBeat = audio.beat;

    for (let i = 0; i < count; i++) {
      const seed = ATMOSPHERE[i];
      const motionTime = this.time * ((this.config?.speed ?? 0.16) / 0.16);
      const position = fireflyFlight(seed, motionTime);
      const bandIndex = audio.spectrum.length ? (i * 7 + 3) % audio.spectrum.length : 0;
      const echo = fireflyEcho((this.time - this.fireflyLastBeatAt) * twinkleSpeed, i % 20);
      const reaction = fireflyAudioResponse(
        audio, audio.spectrum[bandIndex] ?? 0, activity,
        this.time * twinkleSpeed, seed.phase, seed.speed, echo
      );
      // An unlit insect requires no draw call. The scene often renders only
      // 2–5 glows even though 18 different insects can take turns blinking.
      const alpha = Math.min(1, reaction.alpha * (0.60 + seed.depth * 0.40) *
        ((this.config?.opacity ?? 0.7) / 0.7) *
        ((this.config?.audioSensitivity ?? 1.25) / 1.25));
      if (alpha < 0.01) continue;

      const spread = this.config?.particleSpread ?? 1;
      const x = Math.min(0.98, Math.max(0.02, 0.5 + (position.x - 0.5) * spread)) * this.width;
      const y = Math.min(0.98, Math.max(0.02, 0.5 + (position.y - 0.5) * spread)) * this.height;
      // Per-seed depth establishes the size, NEVER amplitude or the beat.
      const size = (10 + seed.size * 3.1 + seed.depth * 5) * (this.config?.particleSize ?? 1);
      ctx.globalAlpha = alpha;
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
    const available = 1 - (this.config?.barGap ?? 0.35);
    ctx.lineWidth = Math.max(0.5, Math.min(this.width / barCount * available,
      this.width / barCount * 0.55 * (available / 0.65) * ((this.config?.lineWidth ?? 2.3) / 2.3)));
    ctx.beginPath();
    for (const point of path.points) {
      const x = point.x * this.width;
      const endpoints = this.barEndpoints(point.y);
      ctx.moveTo(x, endpoints.start);
      ctx.lineTo(x, endpoints.end);
    }
    ctx.stroke();
  }

  /** The math engine supplies 1 - intensity; layout only changes its placement. */
  private barEndpoints(y: number): { start: number; end: number } {
    const extent = (1 - y) * this.height;
    switch (this.config?.barLayout) {
      case 'top': return { start: 0, end: extent };
      case 'center': return { start: this.height / 2 + extent / 2, end: this.height / 2 - extent / 2 };
      default: return { start: this.height, end: y * this.height };
    }
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
    // Read inherited tokens from this canvas so the studio can have its own
    // palette while the player continues inheriting the document's theme.
    const style = getComputedStyle(this.canvasElement.nativeElement);
    return style.getPropertyValue(key).trim()
      || style.getPropertyValue(cssVariable).trim() || fallback;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscription?.unsubscribe();
    this.audioSubscription?.unsubscribe();
    this.fireflySprites = null;
    this.fireflyPreviousBeat = 0;
    this.fireflyLastBeatAt = -Infinity;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.reducedMotion?.removeEventListener?.('change', this.motionHandler);
  }
>>>>>>> Stashed changes
}
