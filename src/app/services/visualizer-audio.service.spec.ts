import { VisualizerAudioService } from './visualizer-audio.service';

describe('VisualizerAudioService', () => {
  let service: VisualizerAudioService;

  beforeEach(() => {
    service = new VisualizerAudioService();
  });

  afterEach(() => {
    service.stopCapture();
  });

  it('defaults to silence without permission', () => {
    expect(service.status).toBe('idle');
    expect(service.isActive).toBeFalse();
    const frame = service.readFrame();
    expect(frame.source).toBe('none');
    expect(frame.level).toBe(0);
    expect(frame.spectrum.length).toBe(0);
  });

  it('stops safely without any active media tracks', () => {
    service.stopCapture();
    service.stopCapture();
    expect(service.status).toBe('idle');
    expect(service.readFrame().source).toBe('none');
  });

  it('does not consider a media share without an audio track valid', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      // Unsupported browsers are covered by the clear error state.
      expect(await service.startCapture()).toBeFalse();
      expect(service.status).toBe('error');
      return;
    }
    const stop = jasmine.createSpy('stop');
    const fake = {
      getVideoTracks: () => [{ getSettings: () => ({ displaySurface: 'browser' }) }],
      getAudioTracks: () => [],
      getTracks: () => [{ stop }]
    } as unknown as MediaStream;

    spyOn(navigator.mediaDevices, 'getDisplayMedia').and.returnValue(Promise.resolve(fake));
    expect(await service.startCapture()).toBeFalse();
    expect(service.status).toBe('error');
    expect(service.errorMessage).toContain('Nenhum áudio');
    expect(stop).toHaveBeenCalled();
  });
});
