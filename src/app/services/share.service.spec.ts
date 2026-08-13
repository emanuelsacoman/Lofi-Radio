import { ShareService } from './share.service';

describe('ShareService', () => {
  const canonicalUrl = 'https://lofiradio.web.app/';
  let clipboard: { copy: jasmine.Spy };
  let toastService: {
    success: jasmine.Spy;
    error: jasmine.Spy;
  };

  beforeEach(() => {
    clipboard = {
      copy: jasmine.createSpy().and.returnValue(true)
    };
    toastService = {
      success: jasmine.createSpy(),
      error: jasmine.createSpy()
    };
  });

  it('uses the native share dialog when it is available', async () => {
    const nativeShare = jasmine.createSpy().and.resolveTo();
    const service = createService({ share: nativeShare });

    await service.shareSite();

    expect(nativeShare).toHaveBeenCalledOnceWith({
      title: 'Lofi Radio',
      text: 'Listen to lofi beats 24/7 while you relax, study, or work.',
      url: canonicalUrl
    });
    expect(clipboard.copy).not.toHaveBeenCalled();
  });

  it('copies the site link when native sharing is unavailable', async () => {
    const service = createService({});

    await service.shareSite();

    expect(clipboard.copy).toHaveBeenCalledOnceWith(canonicalUrl);
    expect(toastService.success).toHaveBeenCalledWith(
      'Link copied.',
      'Share Lofi Radio',
      3000
    );
  });

  it('does nothing when the user cancels native sharing', async () => {
    const nativeShare = jasmine.createSpy().and.rejectWith({ name: 'AbortError' });
    const service = createService({ share: nativeShare });

    await service.shareSite();

    expect(clipboard.copy).not.toHaveBeenCalled();
    expect(toastService.success).not.toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('copies the link when native sharing fails', async () => {
    const nativeShare = jasmine.createSpy().and.rejectWith({ name: 'NotAllowedError' });
    const service = createService({ share: nativeShare });

    await service.shareSite();

    expect(clipboard.copy).toHaveBeenCalledOnceWith(canonicalUrl);
    expect(toastService.success).toHaveBeenCalled();
  });

  it('uses the current origin when no canonical URL is configured', async () => {
    const service = createService({}, null);

    await service.shareSite();

    expect(clipboard.copy).toHaveBeenCalledOnceWith('https://example.com/');
  });

  it('uses the production URL when no browser location is available', async () => {
    const documentMock = {
      querySelector: jasmine.createSpy().and.returnValue(null),
      defaultView: null
    } as unknown as Document;
    const service = new ShareService(documentMock, clipboard as any, toastService as any);

    await service.shareSite();

    expect(clipboard.copy).toHaveBeenCalledOnceWith(canonicalUrl);
  });

  it('shows an error when the link cannot be copied', async () => {
    clipboard.copy.and.returnValue(false);
    const service = createService({});

    await service.shareSite();

    expect(toastService.error).toHaveBeenCalledWith(
      'Unable to share.',
      'Could not copy the link.',
      5000
    );
  });

  function createService(
    navigator: Partial<Navigator>,
    configuredCanonicalUrl: string | null = canonicalUrl
  ): ShareService {
    const documentMock = {
      querySelector: jasmine.createSpy().and.returnValue(
        configuredCanonicalUrl ? { href: configuredCanonicalUrl } : null
      ),
      defaultView: {
        location: {
          href: 'https://example.com/radio?theme=purple'
        },
        navigator
      }
    } as unknown as Document;

    return new ShareService(documentMock, clipboard as any, toastService as any);
  }
});
