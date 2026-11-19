<<<<<<< Updated upstream
export interface VisualizerConfig {
=======
/** Todos os parametros sao editaveis nos presets ou via updateParameters(). */
export type VisualizerGeometry = 'wave' | 'bars';

/** Layered Canvas art direction, separate from the mathematical audio geometry. */
export type VisualizerStyle =
  | 'silk' | 'bars' | 'fireflies';

/** Optional on legacy documents; normalized before rendering or editing. */
export interface VisualizerCustomization {
  scale: number;          // 0.25..2: scale around the center of the viewport
  positionX: number;      // -50..50: horizontal offset in viewport percent
  positionY: number;      // -50..50: vertical offset in viewport percent
  angle: number;          // -180..180: fixed orientation in degrees
  mirrorX: boolean;
  colorMode: 'layered' | 'gradient' | 'solid';
  waveShape: 'sine' | 'triangle' | 'sawtooth';
  barLayout: 'bottom' | 'center' | 'top';
  barGap: number;         // 0.1..0.9: fraction of each bar slot left empty
  particleCount: number;  // 4..96: number of fireflies
  particleSize: number;   // 0.5..3: size multiplier
  particleSpread: number;// 0.25..1.5: spread around the center
  twinkleSpeed: number;   // 0.25..3: flash cadence multiplier
  veilOpacity: number;    // 0..1: opacity multiplier for the wave curtains
}

export interface VisualizerConfig extends Partial<VisualizerCustomization> {
>>>>>>> Stashed changes
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