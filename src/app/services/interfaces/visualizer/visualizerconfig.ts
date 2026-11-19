/** Todos os parametros sao editaveis nos presets ou via updateParameters(). */
export type VisualizerGeometry = 'wave' | 'bars';

/** Layered Canvas art direction, separate from the mathematical audio geometry. */
export type VisualizerStyle =
  | 'silk' | 'bars' | 'fireflies';

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
  id: string;
  name: string;
  icon: string;         // nome de ícone Material exibido no seletor
  geometry: VisualizerGeometry;
  visualStyle: VisualizerStyle; // Visual treatment without changing the math engine
  amplitude: number;     // 0..100: intensidade da deformacao
  audioSensitivity: number; // 0.2..4: ganho das frequencias/da batida reais
  frequency: number;     // 0.25..12: repeticoes espaciais
  speed: number;         // 0..5: velocidade da simulacao (nao e audio real)
  harmonics: number;     // 1..12: ondas sobrepostas
  phase: number;         // -360..360: deslocamento em graus
  color: string;         // 'theme', 'accent' ou cor hexadecimal
  secondaryColor: string;
  lineWidth: number;     // 0.5..10 pixels
  glow: number;          // 0..40 pixels
  opacity: number;       // 0..1
  layers: number;        // 1..8 curvas sobrepostas
  resolution: number;    // 48..768 pontos por curva
  barCount: number;      // 12..96 barras
  rotation: number;      // -5..5 radianos por segundo
}

export type VisualizerParameters = Partial<Omit<VisualizerConfig, 'id' | 'name'>>;
