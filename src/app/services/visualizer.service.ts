import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { VisualizerConfig, VisualizerParameters } from './interfaces/visualizer/visualizerconfig';
import { VisualizerPath, VisualizerPoint } from './interfaces/visualizer/visualizerpoint';
import { DEFAULT_VISUALIZER_ID, VISUALIZER_PRESETS } from './visualizer-presets';
import { VisualizerAudioFrame } from './interfaces/visualizer/visualizer-audio-frame';

const STORAGE_KEY = 'lofi.visualizer.preset.v1';
const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

function validColor(color: string, fallback: string): string {
  if (typeof color !== 'string') return fallback;
  const value = color.trim();
  return ['theme', 'accent', 'secondary', 'accentLight', 'text'].includes(value) || /^#[\da-fA-F]{3}(?:[\da-fA-F]{3})?$/.test(value)
    ? value : fallback;
}

@Injectable({ providedIn: 'root' })
export class VisualizerService {
  private readonly presets: VisualizerConfig[] = VISUALIZER_PRESETS.map((preset: VisualizerConfig) => this.normalizeConfig(preset));
  private readonly activeSubject = new BehaviorSubject<VisualizerConfig | null>(this.restorePreset());

  readonly activeConfig$ = this.activeSubject.asObservable();

  get activeConfig(): VisualizerConfig | null {
    const config = this.activeSubject.value;
    return config ? { ...config } : null;
  }

  get activePresetId(): string | null {
    return this.activeSubject.value?.id ?? null;
  }

  getPresets(): VisualizerConfig[] {
    return this.presets.map((preset: VisualizerConfig) => ({ ...preset }));
  }

  setPreset(id: string | null): boolean {
    if (id === null) {
      this.activeSubject.next(null);
      this.persist(null);
      return true;
    }

    const preset = this.presets.find((item: VisualizerConfig) => item.id === id);
    if (!preset) return false;
    this.activeSubject.next({ ...preset });
    this.persist(id);
    return true;
  }

  updateParameters(patch: VisualizerParameters): void {
    const current = this.activeSubject.value;
    if (!current) return;
    this.activeSubject.next(this.normalizeConfig({ ...current, ...patch }));
  }

  resetParameters(): void {
    const id = this.activePresetId;
    if (id) this.setPreset(id);
  }

  /**
   * Deterministic math only: same config, t, and resolution => same points.
   * The caller owns the render loop and decides whether time advances.
   */
  calculatePaths(timeSeconds: number, resolution?: number, audio?: VisualizerAudioFrame): VisualizerPath[] {
    const config = this.activeSubject.value;
    if (!config) return [];
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const count = clamp(resolution ?? config.resolution, 12, 768, config.resolution) | 0;
    const paths: VisualizerPath[] = [];
    const hasAudio = audio?.source === 'tab';
    const bass = hasAudio ? clamp(audio?.bass ?? 0, 0, 1, 0) : 0;
    const mids = hasAudio ? clamp(audio?.mids ?? 0, 0, 1, 0) : 0;
    const treble = hasAudio ? clamp(audio?.treble ?? 0, 0, 1, 0) : 0;
    const beat = hasAudio ? clamp(audio?.beat ?? 0, 0, 1, 0) : 0;
    const level = hasAudio ? clamp(audio?.level ?? 0, 0, 1, 0) : 0;
    // Silence: resting geometry; live FFT: its amplitude is driven by audio.
    const gain = hasAudio
      ? Math.min(2.6, (0.06 + bass * 1.1 + mids * 0.45 + level * 0.75 + beat * 0.85)
          * config.audioSensitivity)
      : 0.08;
    for (let layer = 0; layer < config.layers; layer++) {
      const points: VisualizerPoint[] = [];
      const isBars = config.geometry === 'bars';
      const steps = isBars ? config.barCount : count;
      for (let i = 0; i < steps; i++) {
        const u = isBars ? (i + 0.5) / steps : i / (steps - 1);
        const signal = this.wave(u, t, layer, config);
        const amount = config.amplitude / 100 * gain;
        const rotation = config.rotation * t + layer * 0.025;
        let x: number;
        let y: number;
        switch (config.geometry) {
          case 'circle': {
            // Periodic integer lobes ensure that the seam is closed.
            const lobes = Math.max(1, Math.round(config.frequency));
            const a = TAU * u + rotation;
            const envelope = Math.sin(TAU * lobes * u + t * config.speed * TAU + layer * 0.4) * (1 + treble * 0.5);
            const radius = 0.25 + 0.03 * layer + envelope * amount * 0.085;
            x = 0.5 + Math.cos(a) * radius;
            y = 0.5 + Math.sin(a) * radius;
            break;
          }
          case 'spiral': {
            const angle = TAU * (u * config.frequency + config.rotation * t);
            const radius = 0.025 + u * 0.40 + signal * amount * (0.045 + treble * 0.03) + layer * 0.012;
            x = 0.5 + Math.cos(angle) * radius;
            y = 0.5 + Math.sin(angle) * radius;
            break;
          }
          case 'lissajous': {
            const a = TAU * (config.frequency * u + config.speed * t) + config.phase * Math.PI / 180;
            const b = TAU * ((config.frequency + 1) * u - config.speed * t);
            const size = 0.22 + Math.min(0.20, amount * 0.17) + layer * 0.008;
            x = 0.5 + Math.sin(a) * size;
            y = 0.5 + Math.sin(b) * size;
            break;
          }
          case 'bars': {
            x = u;
            const spectrum = hasAudio && audio?.spectrum?.length
              ? clamp(audio.spectrum[Math.min(audio.spectrum.length - 1, Math.floor(u * audio.spectrum.length))], 0, 1, 0)
              : 0;
            const intensity = spectrum * config.audioSensitivity;
            const height = hasAudio
              ? Math.min(0.43, 0.006 + Math.pow(intensity, 0.85) *
                  (config.amplitude / 100) * 0.42 + beat * 0.035)
              : 0.008;
            y = 0.5 - height * (1 - layer * 0.13);
            break;
          }
          case 'wave':
          default:
            x = u;
            y = 0.5 + (signal * amount * 0.28 + layer * 0.025 - (config.layers - 1) * 0.0125)
              * Math.sin(Math.PI * u);
        }
        points.push({ x, y });
      }
      paths.push({
        points,
        layer,
        kind: isBars ? 'bar' : 'curve',
        closed: config.geometry === 'circle' || config.geometry === 'lissajous'
      });
    }
    return paths;
  }

  /** Compatibility with the original prototype API. */
  calculatePoints(timeSeconds: number, resolution = 128, audio?: VisualizerAudioFrame): VisualizerPoint[] {
    return this.calculatePaths(timeSeconds, resolution, audio)[0]?.points ?? [];
  }

  private wave(u: number, t: number, layer: number, config: VisualizerConfig): number {
    let signal = 0;
    let total = 0;
    const phase = config.phase * Math.PI / 180 + layer * 0.55;
    for (let harmonic = 1; harmonic <= config.harmonics; harmonic++) {
      const weight = 1 / Math.pow(harmonic, 1.3);
      signal += Math.sin(TAU * (u * config.frequency * harmonic - t * config.speed * (1 + harmonic * 0.08)) + phase) * weight;
      total += weight;
    }
    return total ? signal / total : 0;
  }

  private normalizeConfig(config: VisualizerConfig): VisualizerConfig {
    const allowed = ['wave', 'circle', 'spiral', 'bars', 'lissajous'];
    return {
      ...config,
      geometry: allowed.includes(config.geometry) ? config.geometry : 'wave',
      amplitude: clamp(config.amplitude, 0, 100, 30),
      audioSensitivity: clamp(config.audioSensitivity, 0.2, 4, 1.5),
      frequency: clamp(config.frequency, 0.25, 12, 3),
      speed: clamp(config.speed, 0, 5, 0.2),
      harmonics: Math.round(clamp(config.harmonics, 1, 12, 2)),
      phase: clamp(config.phase, -360, 360, 0),
      color: validColor(config.color, 'theme'),
      secondaryColor: validColor(config.secondaryColor, 'accent'),
      lineWidth: clamp(config.lineWidth, 0.5, 10, 2),
      glow: clamp(config.glow, 0, 40, 10),
      opacity: clamp(config.opacity, 0, 1, 0.8),
      layers: Math.round(clamp(config.layers, 1, 8, 3)),
      resolution: Math.round(clamp(config.resolution, 48, 768, 256)),
      barCount: Math.round(clamp(config.barCount, 12, 96, 48)),
      rotation: clamp(config.rotation, -5, 5, 0)
    };
  }

  private restorePreset(): VisualizerConfig | null {
    let stored: string | null = null;
    try { stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY); }
    catch { /* Storage may be disabled by browser settings. */ }
    if (stored === 'off') return null;
    const preset = this.presets.find((item: VisualizerConfig) => item.id === (stored || DEFAULT_VISUALIZER_ID))
      ?? this.presets[0];
    return preset ? { ...preset } : null;
  }

  private persist(id: string | null): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, id ?? 'off');
    } catch { /* Keep visualizer usable without persistent storage. */ }
  }
}
