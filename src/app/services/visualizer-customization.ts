import { VisualizerCustomization } from './interfaces/visualizer/visualizerconfig';

/** Values reproduce existing creations when a stored document predates these controls. */
export const VISUALIZER_CUSTOMIZATION_DEFAULTS: Readonly<VisualizerCustomization> = {
  scale: 1, positionX: 0, positionY: 0, angle: 0, mirrorX: false,
  colorMode: 'layered', waveShape: 'sine', barLayout: 'bottom', barGap: 0.35,
  particleCount: 18, particleSize: 1, particleSpread: 1,
  twinkleSpeed: 1, veilOpacity: 1
};

type NumericCustomizationField = {
  [K in keyof VisualizerCustomization]: VisualizerCustomization[K] extends number ? K : never
}[keyof VisualizerCustomization];

export const VISUALIZER_CUSTOMIZATION_LIMITS: Record<NumericCustomizationField, readonly [number, number, boolean?]> = {
  scale: [0.25, 2], positionX: [-50, 50], positionY: [-50, 50], angle: [-180, 180],
  barGap: [0.1, 0.9], particleCount: [4, 96, true], particleSize: [0.5, 3],
  particleSpread: [0.25, 1.5], twinkleSpeed: [0.25, 3], veilOpacity: [0, 1]
};

export const VISUALIZER_CUSTOMIZATION_CHOICES = {
  colorMode: ['layered', 'gradient', 'solid'],
  waveShape: ['sine', 'triangle', 'sawtooth'],
  barLayout: ['bottom', 'center', 'top']
} as const;

/** Safe for partially entered form values. Persistence validates instead of silently clamping. */
export function normalizeVisualizerCustomization(config: Partial<VisualizerCustomization>): VisualizerCustomization {
  const result: VisualizerCustomization = { ...VISUALIZER_CUSTOMIZATION_DEFAULTS };
  for (const key of Object.keys(VISUALIZER_CUSTOMIZATION_LIMITS) as NumericCustomizationField[]) {
    const value = config[key];
    const [min, max, integer] = VISUALIZER_CUSTOMIZATION_LIMITS[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      const bounded = Math.min(max, Math.max(min, value));
      result[key] = integer ? Math.round(bounded) : bounded;
    }
  }
  result.mirrorX = typeof config.mirrorX === 'boolean' ? config.mirrorX : result.mirrorX;
  if (config.colorMode && VISUALIZER_CUSTOMIZATION_CHOICES.colorMode.includes(config.colorMode)) result.colorMode = config.colorMode;
  if (config.waveShape && VISUALIZER_CUSTOMIZATION_CHOICES.waveShape.includes(config.waveShape)) result.waveShape = config.waveShape;
  if (config.barLayout && VISUALIZER_CUSTOMIZATION_CHOICES.barLayout.includes(config.barLayout)) result.barLayout = config.barLayout;
  return result;
}
