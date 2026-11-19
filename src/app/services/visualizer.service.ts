<<<<<<< Updated upstream
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
=======
import { Injectable, OnDestroy, Optional } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { VisualizerConfig, VisualizerParameters, VisualizerStyle } from './interfaces/visualizer/visualizerconfig';
import { VisualizerPath, VisualizerPoint } from './interfaces/visualizer/visualizerpoint';
import { VisualizerAudioFrame } from './interfaces/visualizer/visualizer-audio-frame';
import { VisualizerCatalogService } from './visualizer-catalog.service';
import { normalizeVisualizerCustomization } from './visualizer-customization';

export type VisualizerCatalogStatus = 'loading' | 'ready' | 'error';
>>>>>>> Stashed changes

import { VisualizerConfig } from './interfaces/visualizer/visualizerconfig';
import { VisualizerPoint } from './interfaces/visualizer/visualizerpoint';

type VisualizerParameters = Partial<
  Pick<
    VisualizerConfig,
    | 'geometry'
    | 'amplitude'
    | 'frequency'
    | 'speed'
    | 'harmonics'
    | 'phase'
    | 'color'
  >
>;

<<<<<<< Updated upstream
@Injectable({
  providedIn: 'root'
})
export class VisualizerService {

  private readonly presets: VisualizerConfig[] = [
    {
      id: 'default-wave',
      name: 'Default Wave',
      geometry: 'wave',
      amplitude: 30,
      frequency: 3,
      speed: 0.2,
      harmonics: 2,
      phase: 0,
      color: '#aea4d3'
    }
  ];

  private readonly activeSubject =
    new BehaviorSubject<VisualizerConfig | null>(null);
=======
function validColor(color: string, fallback: string): string {
  if (typeof color !== 'string') return fallback;
  const value = color.trim();
  return ['theme', 'accent', 'secondary', 'accentLight', 'text'].includes(value) || /^#[\da-fA-F]{3}(?:[\da-fA-F]{3})?$/.test(value)
    ? value : fallback;
}

@Injectable({ providedIn: 'root' })
export class VisualizerService implements OnDestroy {
  private presets: VisualizerConfig[] = [];
  private pendingPresetId: string | null = null;
  private readonly activeSubject = new BehaviorSubject<VisualizerConfig | null>(this.restorePreset());
  private readonly presetsSubject = new BehaviorSubject<VisualizerConfig[]>(this.getPresets());
  private readonly catalogStatusSubject = new BehaviorSubject<VisualizerCatalogStatus>('loading');
  private catalogSubscription?: Subscription;
>>>>>>> Stashed changes

  readonly activeConfig$ = this.activeSubject.asObservable();
  readonly presets$ = this.presetsSubject.asObservable();
  readonly catalogStatus$ = this.catalogStatusSubject.asObservable();

  constructor(@Optional() private catalog?: VisualizerCatalogService) {
    this.reloadCatalog();
  }

  reloadCatalog(): void {
    this.catalogSubscription?.unsubscribe();
    if (!this.catalog) {
      this.catalogStatusSubject.next('ready');
      return;
    }
    this.catalogStatusSubject.next('loading');
    this.catalogSubscription = this.catalog.watchPublished().subscribe({
      next: documents => {
        this.mergeCatalog(documents);
        this.catalogStatusSubject.next('ready');
      },
      error: () => {
        // The database is the only catalog. Never invent local replacements.
        this.presets = [];
        this.presetsSubject.next([]);
        this.setPreset(null);
        this.catalogStatusSubject.next('error');
      }
    });
  }

  get activeConfig(): VisualizerConfig | null {
    const config = this.activeSubject.value;
    return config ? { ...config } : null;
  }

  getPresets(): VisualizerConfig[] {
    return this.presets.map(preset => ({ ...preset }));
  }

  setPreset(id: string | null): boolean {
    if (id === null) {
      this.pendingPresetId = null;
      this.activeSubject.next(null);
      return true;
    }

    const preset = this.presets.find(
      item => item.id === id
    );

    if (!preset) return false;
<<<<<<< Updated upstream

=======
    this.pendingPresetId = null;
>>>>>>> Stashed changes
    this.activeSubject.next({ ...preset });
    return true;
  }

  updateParameters(patch: VisualizerParameters): void {
    const current = this.activeSubject.value;

    if (!current) return;

    const updated = this.normalizeConfig({
      ...current,
      ...patch
    });

    this.activeSubject.next(updated);
  }

  calculatePoints(
    timeSeconds: number,
    resolution = 128
  ): VisualizerPoint[] {

    const config = this.activeSubject.value;

    if (!config) return [];
<<<<<<< Updated upstream

    const count = Number.isFinite(resolution)
      ? Math.max(2, Math.min(2048, Math.floor(resolution)))
      : 128;

    const time = Number.isFinite(timeSeconds)
      ? timeSeconds
      : 0;

    const points: VisualizerPoint[] = [];

    for (let i = 0; i < count; i++) {
      const progress = i / (count - 1);

      points.push(
        this.calculatePoint(progress, time, config)
      );
    }

    return points;
  }

  private calculatePoint(
    progress: number,
    time: number,
    config: VisualizerConfig
  ): VisualizerPoint {

    const signal = this.calculateWave(progress, time, config);
    const amplitude = config.amplitude / 100;
    const angle = progress * Math.PI * 2;

    switch (config.geometry) {

      case 'circle': {
        const radius = 0.25 + signal * amplitude * 0.14;

        return {
          x: 0.5 + Math.cos(angle) * radius,
          y: 0.5 + Math.sin(angle) * radius
        };
=======
    return this.calculatePathsForConfig(config, timeSeconds, resolution, audio);
  }

  /** Pure renderer entry point for the studio: never selects or persists a preset. */
  calculatePathsForConfig(
    config: VisualizerConfig, timeSeconds: number, resolution?: number, audio?: VisualizerAudioFrame
  ): VisualizerPath[] {
    // A form can emit incomplete or out-of-range numbers while typing. Bound
    // every loop here as well as at the UI boundary so this public API is safe.
    config = this.normalizeConfig(config);
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const count = clamp(resolution ?? config.resolution, 12, 768, config.resolution) | 0;
    const paths: VisualizerPath[] = [];
    const hasAudio = audio?.source === 'tab';
    const bass = hasAudio ? clamp(audio?.bass ?? 0, 0, 1, 0) : 0;
    const mids = hasAudio ? clamp(audio?.mids ?? 0, 0, 1, 0) : 0;
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
        const signal = isBars ? 0 : this.wave(u, t, layer, config);
        const amount = config.amplitude / 100 * gain;
        let x: number;
        let y: number;
        switch (config.geometry) {
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
>>>>>>> Stashed changes
      }

      case 'spiral': {
        const turns = Math.max(1, config.frequency);
        const spiralAngle = progress * Math.PI * 2 * turns;

        const radius = Math.max(
          0,
          0.04 + progress * 0.36 + signal * amplitude * 0.05
        );

        return {
          x: 0.5 + Math.cos(spiralAngle) * radius,
          y: 0.5 + Math.sin(spiralAngle) * radius
        };
      }

      case 'wave':
      default:
        return {
          x: progress,
          y: 0.5 +
            signal *
            amplitude *
            0.4 *
            Math.sin(Math.PI * progress)
        };
    }
  }

  private calculateWave(
    progress: number,
    time: number,
    config: VisualizerConfig
  ): number {

<<<<<<< Updated upstream
    const phase = config.phase * Math.PI / 180;

    const baseAngle =
      Math.PI * 2 *
      (config.frequency * progress - config.speed * time)
      + phase;

    let result = 0;
    let totalWeight = 0;

    for (let n = 1; n <= config.harmonics; n++) {
      const weight = 1 / n;

      result += Math.sin(baseAngle * n) * weight;
      totalWeight += weight;
=======
  private wave(u: number, t: number, layer: number, config: VisualizerConfig): number {
    let signal = 0;
    let total = 0;
    const phase = config.phase * Math.PI / 180 + layer * 0.55;
    for (let harmonic = 1; harmonic <= config.harmonics; harmonic++) {
      const weight = 1 / Math.pow(harmonic, 1.3);
      const angle = TAU * (u * config.frequency * harmonic - t * config.speed * (1 + harmonic * 0.08)) + phase;
      let sample: number;
      switch (config.waveShape) {
        case 'triangle': sample = 2 / Math.PI * Math.asin(Math.sin(angle)); break;
        case 'sawtooth': {
          const cycles = angle / TAU;
          sample = 2 * (cycles - Math.floor(cycles + 0.5));
          break;
        }
        default: sample = Math.sin(angle);
      }
      signal += sample * weight;
      total += weight;
>>>>>>> Stashed changes
    }

    return result / totalWeight;
  }

<<<<<<< Updated upstream
  private normalizeConfig(
    config: VisualizerConfig
  ): VisualizerConfig {

    const clamp = (
      value: number,
      min: number,
      max: number,
      fallback: number
    ) =>
      Number.isFinite(value)
        ? Math.max(min, Math.min(max, value))
        : fallback;

    return {
      ...config,

      geometry: (
        ['wave', 'circle', 'spiral'] as string[]
      ).includes(config.geometry)
        ? config.geometry
        : 'wave',

=======
  /** Returns a bounded copy without modifying either the draft or active preset. */
  normalizeConfig(config: VisualizerConfig): VisualizerConfig {
    const allowed = ['wave', 'bars'];
    const styles: VisualizerStyle[] = [
      'silk', 'bars', 'fireflies'
    ];
    return {
      ...config,
      ...normalizeVisualizerCustomization(config),
      geometry: allowed.includes(config.geometry) ? config.geometry : 'wave',
      visualStyle: styles.includes(config.visualStyle) ? config.visualStyle : 'silk',
      icon: typeof config.icon === 'string' && /^[a-z_]{1,40}$/.test(config.icon) ? config.icon : 'graphic_eq',
>>>>>>> Stashed changes
      amplitude: clamp(config.amplitude, 0, 100, 30),
      frequency: clamp(config.frequency, 0.1, 12, 3),
      speed: clamp(config.speed, 0, 5, 0.2),
      harmonics: Math.round(
        clamp(config.harmonics, 1, 12, 2)
      ),
      phase: clamp(config.phase, -360, 360, 0),

      color: typeof config.color === 'string'
        && config.color.trim()
          ? config.color.trim()
          : '#aea4d3'
    };
  }
<<<<<<< Updated upstream
}
=======

  private restorePreset(): VisualizerConfig | null {
    let stored: string | null = null;
    try { stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY); }
    catch { /* Storage may be disabled by browser settings. */ }
    // A fresh visit starts Off. Sharing permission is never requested on load.
    if (!stored || stored === 'off') return null;
    // A stored ID never supplies a local visual: wait for its published document.
    this.pendingPresetId = stored;
    return null;
  }

  private mergeCatalog(documents: VisualizerConfig[]): void {
    const previous = this.activeSubject.value;
    const previousDefinition = this.presets.find(preset => preset.id === previous?.id);
    const merged = new Map<string, VisualizerConfig>();
    for (const document of documents) {
      merged.set(document.id, this.normalizeConfig(document));
    }
    this.presets = Array.from(merged.values());
    this.presetsSubject.next(this.getPresets());

    const selectedId = previous?.id ?? this.pendingPresetId;
    if (!selectedId) return;
    const selected = this.presets.find(preset => preset.id === selectedId);
    if (selected) {
      this.pendingPresetId = null;
      // Keep local fine-tuning unless the saved preset actually changed.
      if (!previous || JSON.stringify(previousDefinition) !== JSON.stringify(selected)) {
        this.activeSubject.next({ ...selected });
      }
    } else if (previous) {
      // Deleting/unpublishing an active custom preset turns the effect off.
      this.setPreset(null);
    }
  }

  ngOnDestroy(): void {
    this.catalogSubscription?.unsubscribe();
    this.presetsSubject.complete();
    this.catalogStatusSubject.complete();
    this.activeSubject.complete();
  }

  private persist(id: string | null): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, id ?? 'off');
    } catch { /* Keep visualizer usable without persistent storage. */ }
  }
}
>>>>>>> Stashed changes
