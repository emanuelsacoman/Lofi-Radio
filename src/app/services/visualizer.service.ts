import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { VisualizerConfig, VisualizerParameters, VisualizerStyle } from './interfaces/visualizer/visualizerconfig';
import { VisualizerPath, VisualizerPoint } from './interfaces/visualizer/visualizerpoint';
import { VISUALIZER_PRESETS } from './visualizer-presets';
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
   * Measures actual spectral activity, ignoring beat decay in periods of silence.
   * Zero activity means no captured sound (or just analyser noise).
   */
  getAudioActivity(audio?: VisualizerAudioFrame): number {
    if (audio?.source !== 'tab') return 0;
    const level = clamp(audio.level, 0, 1, 0);
    const bass = clamp(audio.bass, 0, 1, 0);
    const mids = clamp(audio.mids, 0, 1, 0);
    const treble = clamp(audio.treble, 0, 1, 0);
    let spectrumPeak = 0;
    for (const bin of audio.spectrum) {
      spectrumPeak = Math.max(spectrumPeak, clamp(bin, 0, 1, 0));
    }
    const energy = Math.max(
      level * 1.5, bass * 0.9, mids * 0.9, treble * 0.8, spectrumPeak * 0.7
    );
    // Remove the noise floor before scaling to a visibility factor.
    return clamp((energy - 0.025) / 0.5, 0, 1, 0);
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
    const activity = this.getAudioActivity(audio);
    // Quiet audio yields zero deformation; no synthetic motion during silence.
    const gain = Math.min(2.6, (bass * 1.1 + mids * 0.45 + level * 0.75 +
      beat * 0.85) * config.audioSensitivity) * activity;
    for (let layer = 0; layer < config.layers; layer++) {
      const points: VisualizerPoint[] = [];
      const isBars = config.geometry === 'bars';
      const steps = isBars ? config.barCount : count;
      for (let i = 0; i < steps; i++) {
        const u = isBars ? (i + 0.5) / steps : i / (steps - 1);
        const signal = this.wave(u, t, layer, config);
        const amount = config.amplitude / 100 * gain;
        let x: number;
        let y: number;
        switch (config.geometry) {
          case 'spiral': {
            const angle = TAU * (u * config.frequency + config.rotation * t);
            const radius = (0.025 + u * 0.40 + layer * 0.012) * activity +
              signal * amount * (0.045 + treble * 0.03);
            x = 0.5 + Math.cos(angle) * radius;
            y = 0.5 + Math.sin(angle) * radius;
            break;
          }
          case 'bars': {
            x = u;
            const spectrum = hasAudio && audio?.spectrum?.length
              ? clamp(audio.spectrum[Math.min(audio.spectrum.length - 1, Math.floor(u * audio.spectrum.length))], 0, 1, 0)
              : 0;
            // Bars originate at y=1 (bottom of viewport) and rise with
            // their own FFT bands. Silence yields exactly zero height.
            const intensity = Math.max(0, spectrum - 0.025) * config.audioSensitivity;
            const height = hasAudio
              ? Math.min(0.88, (Math.pow(intensity, 0.85) * 0.75 +
                  beat * spectrum * 0.10) * (config.amplitude / 100) *
                  (1 - layer * 0.13) * activity)
              : 0;
            y = 1 - height;
            break;
          }
          case 'wave':
          default:
            x = u;
            y = 0.5 + (signal * amount * 0.28 +
              (layer * 0.025 - (config.layers - 1) * 0.0125) * activity)
              * Math.sin(Math.PI * u);
        }
        points.push({ x, y });
      }
      paths.push({
        points,
        layer,
        kind: isBars ? 'bar' : 'curve',
        closed: false
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
    const allowed = ['wave', 'spiral', 'bars'];
    const styles: VisualizerStyle[] = [
      'silk', 'vortex', 'bars', 'fireflies'
    ];
    return {
      ...config,
      geometry: allowed.includes(config.geometry) ? config.geometry : 'wave',
      visualStyle: styles.includes(config.visualStyle) ? config.visualStyle : 'silk',
      icon: typeof config.icon === 'string' && /^[a-z_]{1,40}$/.test(config.icon) ? config.icon : 'graphic_eq',
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
    // A fresh visit starts Off. Sharing permission is never requested on load.
    if (!stored || stored === 'off') return null;
    // Removed presets must not silently switch the user to an unrelated effect.
    const preset = this.presets.find((item: VisualizerConfig) => item.id === stored);
    return preset ? { ...preset } : null;
  }

  private persist(id: string | null): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, id ?? 'off');
    } catch { /* Keep visualizer usable without persistent storage. */ }
  }
}
