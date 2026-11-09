import { VisualizerConfig } from './interfaces/visualizer/visualizerconfig';

/**
 * Laboratorio de visuais: altere valores aqui para criar outros resultados.
 * Cada preset usa o MESMO motor matematico e o MESMO Canvas.
 * 'theme' usa --clr-primary; 'accent' usa --clr-accent.
 */
export const DEFAULT_VISUALIZER_ID = 'aurora-wave';

export const VISUALIZER_PRESETS: ReadonlyArray<VisualizerConfig> = [
  {
    id: 'aurora-wave', name: 'Waveform', icon: 'show_chart', geometry: 'wave', visualStyle: 'silk',
    amplitude: 45,
    audioSensitivity: 1.7, frequency: 3.2, speed: 0.35, harmonics: 4, phase: 0,
    color: 'theme', secondaryColor: 'accent',
    lineWidth: 2.2, glow: 18, opacity: 0.82, layers: 4,
    resolution: 280, barCount: 48, rotation: 0
  },
  {
    id: 'orbit-bloom', name: 'Orbit', icon: 'radio_button_checked', geometry: 'circle', visualStyle: 'orbit',
    amplitude: 55,
    audioSensitivity: 1.45, frequency: 7, speed: 0.22, harmonics: 4, phase: 45,
    color: 'theme', secondaryColor: 'accent',
    lineWidth: 1.7, glow: 15, opacity: 0.78, layers: 4,
    resolution: 420, barCount: 48, rotation: 0.08
  },
  {
    id: 'cosmic-spiral', name: 'Spiral', icon: 'cyclone', geometry: 'spiral', visualStyle: 'vortex',
    amplitude: 40,
    audioSensitivity: 1.4, frequency: 4.5, speed: 0.28, harmonics: 3, phase: 30,
    color: 'accent', secondaryColor: 'secondary',
    lineWidth: 1.6, glow: 12, opacity: 0.72, layers: 3,
    resolution: 500, barCount: 48, rotation: 0.12
  },
  {
    id: 'pulse-bars', name: 'Equalizer', icon: 'graphic_eq', geometry: 'bars', visualStyle: 'bars',
    amplitude: 75,
    audioSensitivity: 2.1, frequency: 5, speed: 0.54, harmonics: 5, phase: 0,
    color: 'theme', secondaryColor: 'accentLight',
    lineWidth: 2.3, glow: 10, opacity: 0.85, layers: 2,
    resolution: 128, barCount: 54, rotation: 0
  },
  {
    id: 'lissajous-dream', name: 'Lissajous', icon: 'all_inclusive', geometry: 'lissajous', visualStyle: 'constellation',
    amplitude: 58,
    audioSensitivity: 1.5, frequency: 3, speed: 0.18, harmonics: 3, phase: 90,
    color: 'theme', secondaryColor: 'accent',
    lineWidth: 1.4, glow: 16, opacity: 0.72, layers: 5,
    resolution: 600, barCount: 48, rotation: 0.1
  },
  {
    id: 'moonlit-fireflies', name: 'Firefly Garden', icon: 'flare',
    geometry: 'wave', visualStyle: 'fireflies',
    amplitude: 24, audioSensitivity: 1.25, frequency: 2.2, speed: 0.16,
    harmonics: 2, phase: 0, color: 'accentLight', secondaryColor: 'theme',
    lineWidth: 1.1, glow: 28, opacity: 0.7, layers: 2,
    resolution: 160, barCount: 32, rotation: 0
  },
  {
    id: 'neon-meteor-rain', name: 'Meteor Shower', icon: 'auto_awesome',
    geometry: 'bars', visualStyle: 'meteor',
    amplitude: 82, audioSensitivity: 1.65, frequency: 4.2, speed: 0.48,
    harmonics: 3, phase: 0, color: 'accent', secondaryColor: 'accentLight',
    lineWidth: 1.8, glow: 20, opacity: 0.8, layers: 2,
    resolution: 128, barCount: 40, rotation: 0
  },
  {
    id: 'lotus-dream', name: 'Lotus Dream', icon: 'filter_vintage',
    geometry: 'circle', visualStyle: 'lotus',
    amplitude: 46, audioSensitivity: 1.35, frequency: 8, speed: 0.16,
    harmonics: 4, phase: 0, color: 'theme', secondaryColor: 'accentLight',
    lineWidth: 1.55, glow: 20, opacity: 0.8, layers: 5,
    resolution: 320, barCount: 48, rotation: 0.03
  }
];
