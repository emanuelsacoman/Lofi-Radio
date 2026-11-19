/**
 * Measurements from audio the user explicitly chose to share.
 * 'none' must never be represented as real music data.
 */
export interface VisualizerAudioFrame {
  source: 'none' | 'tab';
  level: number;
  bass: number;
  mids: number;
  treble: number;
  beat: number;
  spectrum: readonly number[];
}

export const SILENT_AUDIO_FRAME: VisualizerAudioFrame = {
  source: 'none',
  level: 0,
  bass: 0,
  mids: 0,
  treble: 0,
  beat: 0,
  spectrum: []
};

export type VisualizerCaptureStatus = 'idle' | 'requesting' | 'active' | 'error';
