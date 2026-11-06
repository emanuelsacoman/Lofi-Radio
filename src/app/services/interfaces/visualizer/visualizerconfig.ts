export interface VisualizerConfig {
  id: string;
  name: string;

  geometry: 'wave' | 'circle' | 'spiral';

  amplitude: number;
  frequency: number;
  speed: number;
  harmonics: number;
  phase: number;

  color: string;
}