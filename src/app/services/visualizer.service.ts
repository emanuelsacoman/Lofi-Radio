import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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

  readonly activeConfig$ = this.activeSubject.asObservable();

  get activeConfig(): VisualizerConfig | null {
    const config = this.activeSubject.value;
    return config ? { ...config } : null;
  }

  getPresets(): VisualizerConfig[] {
    return this.presets.map(preset => ({ ...preset }));
  }

  setPreset(id: string | null): boolean {
    if (id === null) {
      this.activeSubject.next(null);
      return true;
    }

    const preset = this.presets.find(
      item => item.id === id
    );

    if (!preset) return false;

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
    }

    return result / totalWeight;
  }

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
}