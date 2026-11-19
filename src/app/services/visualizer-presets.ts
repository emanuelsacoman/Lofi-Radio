import { VisualizerConfig } from './interfaces/visualizer/visualizerconfig';
import { VISUALIZER_CUSTOMIZATION_DEFAULTS } from './visualizer-customization';

/**
 * Starting templates for the admin editor only. The player catalog comes from
 * Firestore; these values never publish a creation or populate its selector.
 * 'theme' usa --clr-primary; 'accent' usa --clr-accent.
 */
export const DEFAULT_VISUALIZER_ID = 'aurora-wave';

export const VISUALIZER_PRESETS: ReadonlyArray<VisualizerConfig> = [
  {
    ...VISUALIZER_CUSTOMIZATION_DEFAULTS,
    id: 'aurora-wave', name: 'Waveform', icon: 'show_chart', geometry: 'wave', visualStyle: 'silk',
    amplitude: 45,
    audioSensitivity: 1.7, frequency: 3.2, speed: 0.35, harmonics: 4, phase: 0,
    color: 'theme', secondaryColor: 'accent',
    lineWidth: 2.2, glow: 18, opacity: 0.82, layers: 4,
    resolution: 280, barCount: 48, rotation: 0
  },
  {
    ...VISUALIZER_CUSTOMIZATION_DEFAULTS,
    id: 'pulse-bars', name: 'Equalizer', icon: 'graphic_eq', geometry: 'bars', visualStyle: 'bars',
    amplitude: 75,
    audioSensitivity: 2.1, frequency: 5, speed: 0.54, harmonics: 5, phase: 0,
    color: 'theme', secondaryColor: 'accentLight',
    lineWidth: 2.3, glow: 10, opacity: 0.85, layers: 2,
    resolution: 128, barCount: 54, rotation: 0
  },
  {
    ...VISUALIZER_CUSTOMIZATION_DEFAULTS,
    id: 'moonlit-fireflies', name: 'Firefly Garden', icon: 'flare',
    geometry: 'wave', visualStyle: 'fireflies',
    amplitude: 24, audioSensitivity: 1.25, frequency: 2.2, speed: 0.16,
    harmonics: 2, phase: 0, color: 'accentLight', secondaryColor: 'theme',
    lineWidth: 1.1, glow: 0, opacity: 0.7, layers: 1,
    resolution: 48, barCount: 16, rotation: 0
  }
];
