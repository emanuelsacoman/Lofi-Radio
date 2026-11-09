import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SILENT_AUDIO_FRAME, VisualizerAudioFrame, VisualizerCaptureStatus
} from './interfaces/visualizer/visualizer-audio-frame';

const BAND_COUNT = 64;
const ZERO_FRAME = SILENT_AUDIO_FRAME;

function bounded(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Audio is read locally from a browser tab explicitly selected by the user.
 * The audio stream is NEVER replayed, recorded, uploaded or sent to Firebase.
 * The selected YouTube iframe is NOT accessible via Web Audio directly.
 */
@Injectable({ providedIn: 'root' })
export class VisualizerAudioService {
  private readonly statusSubject = new BehaviorSubject<VisualizerCaptureStatus>('idle');
  readonly status$ = this.statusSubject.asObservable();

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencies: Uint8Array = new Uint8Array(0);
  private waveform: Uint8Array = new Uint8Array(0);
  private baselineBass = 0;
  private previousBass = 0;
  private beatEnvelope = 0;
  private lastBeatAt = -Infinity;
  private captureGeneration = 0;

  errorMessage = '';

  get status(): VisualizerCaptureStatus {
    return this.statusSubject.value;
  }

  get isActive(): boolean {
    return this.status === 'active' && this.context?.state === 'running'
      && !!this.analyser && !!this.stream?.getAudioTracks().some(track => track.readyState === 'live');
  }

  /**
   * Must be invoked directly by a real button click. getDisplayMedia() always
   * opens the browser share dialog. Choosing another tab or omitting tab audio
   * does not provide sound from this radio.
   */
  async startCapture(): Promise<boolean> {
    if (this.status === 'requesting') return false;
    if (this.isActive) return true;
    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getDisplayMedia || typeof AudioContext === 'undefined') {
      this.fail('Este navegador não suporta captura de áudio de abas. Use Chrome ou Edge em HTTPS/localhost.');
      return false;
    }

    this.stopCapture();
    const generation = ++this.captureGeneration;
    this.errorMessage = '';
    this.statusSubject.next('requesting');
    let stream: MediaStream | null = null;

    try {
      // Audio from a YouTube iframe is cross-origin: capture requires user consent.
      // We request tab sharing rather than microphone or entire-system audio.
      const options = {
        video: { displaySurface: 'browser' },
        audio: { suppressLocalAudioPlayback: false },
        preferCurrentTab: true,
        systemAudio: 'exclude'
      } as DisplayMediaStreamOptions;

      stream = await mediaDevices.getDisplayMedia(options);
      if (generation !== this.captureGeneration) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }

      const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface;
      if (surface && surface !== 'browser') {
        throw new Error('Selecione a aba do Lofi Radio, não uma janela ou a tela inteira.');
      }
      if (stream.getAudioTracks().length === 0) {
        throw new Error('Nenhum áudio foi compartilhado. Selecione esta aba e habilite “Compartilhar áudio da guia”.');
      }

      const context = new AudioContext();
      this.stream = stream;
      this.context = context;
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.68;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.frequencies = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveform = new Uint8Array(this.analyser.fftSize);
      this.source = context.createMediaStreamSource(stream);
      // Do not connect the analyser to destination: avoids doubled playback/echo.
      this.source.connect(this.analyser);

      // Stopping browser sharing also destroys all Web Audio resources.
      const stop = () => {
        if (generation === this.captureGeneration) this.stopCapture();
      };
      stream.getTracks().forEach(track => track.addEventListener('ended', stop, { once: true }));
      await context.resume();
      if (generation !== this.captureGeneration) return false;
      if (!stream.getAudioTracks().some(track => track.readyState === 'live')) {
        throw new Error('A captura de áudio foi encerrada antes de começar.');
      }
      this.statusSubject.next('active');
      return true;
    } catch (error: unknown) {
      // If validation failed before assigning this.stream, browser capture still
      // needs to be stopped explicitly (including the video permission indicator).
      if (stream && stream !== this.stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (generation !== this.captureGeneration) return false;
      this.stopCapture();
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Selecione a aba') || message.includes('Nenhum áudio') ||
          message.includes('captura de áudio foi encerrada')) {
        this.fail(message);
      } else if (error instanceof DOMException &&
                 (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        this.fail('Captura cancelada. Clique novamente e compartilhe a aba do Lofi Radio com áudio.');
      } else {
        this.fail('Não foi possível analisar o áudio compartilhado. Verifique as permissões e tente novamente.');
      }
      return false;
    }
  }

  /** Called on a user action, navigation or whenever the browser stops sharing. */
  stopCapture(): void {
    ++this.captureGeneration;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.context) {
      void this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.frequencies = new Uint8Array(0);
    this.waveform = new Uint8Array(0);
    this.baselineBass = 0;
    this.previousBass = 0;
    this.beatEnvelope = 0;
    this.lastBeatAt = -Infinity;
    this.statusSubject.next('idle');
  }

  /** One local FFT read per render frame. No permission => exact silence. */
  readFrame(): VisualizerAudioFrame {
    if (!this.isActive || !this.analyser || !this.context) return ZERO_FRAME;

    this.analyser.getByteFrequencyData(this.frequencies);
    this.analyser.getByteTimeDomainData(this.waveform);
    const nyquist = this.context.sampleRate / 2;

    const band = (low: number, high: number): number => {
      const from = Math.max(0, Math.floor(low / nyquist * this.frequencies.length));
      const to = Math.min(this.frequencies.length, Math.max(from + 1,
        Math.ceil(high / nyquist * this.frequencies.length)));
      let sum = 0;
      for (let i = from; i < to; i++) sum += this.frequencies[i];
      return bounded((sum / Math.max(1, to - from) / 255 - 0.045) * 1.55);
    };

    // RMS follows actual volume, including quiet breaks in the live stream.
    let squares = 0;
    for (let i = 0; i < this.waveform.length; i++) {
      const sample = (this.waveform[i] - 128) / 128;
      squares += sample * sample;
    }
    const rms = Math.sqrt(squares / Math.max(1, this.waveform.length));
    const level = bounded(Math.max(0, rms - 0.006) * 5);
    const bass = band(35, 180);
    const mids = band(180, 2100);
    const treble = band(2100, 9000);

    const now = performance.now();
    const onset = bass - this.previousBass;
    const beat = bass > 0.15 &&
      onset > 0.035 &&
      bass > this.baselineBass * 1.18 + 0.025 &&
      now - this.lastBeatAt > 220;

    if (beat) {
      this.lastBeatAt = now;
      this.beatEnvelope = 1;
    } else {
      this.beatEnvelope *= 0.86;
    }
    this.baselineBass = this.baselineBass * 0.96 + bass * 0.04;
    this.previousBass = bass;

    // Logarithmic buckets approximate how people perceive low to high notes.
    const spectrum: number[] = [];
    for (let i = 0; i < BAND_COUNT; i++) {
      const low = 35 * Math.pow(9000 / 35, i / BAND_COUNT);
      const high = 35 * Math.pow(9000 / 35, (i + 1) / BAND_COUNT);
      spectrum.push(band(low, high));
    }

    return {
      source: 'tab',
      level, bass, mids, treble,
      beat: this.beatEnvelope,
      spectrum
    };
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.statusSubject.next('error');
  }
}
