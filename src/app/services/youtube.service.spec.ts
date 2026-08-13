import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { YoutubeService } from './youtube.service';

describe('YoutubeService', () => {
  let service: YoutubeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(YoutubeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads video details in API-safe chunks and preserves the requested order', () => {
    const videoIds = Array.from({ length: 64 }, (_, index) => `video-${index + 1}`);
    let result: Array<{ title: string; creator: string }> = [];

    service.getVideoDetailsBatch(videoIds).subscribe(details => result = details);

    const requests = httpTesting.match(request => request.url.includes('/youtube/v3/videos'));
    expect(requests.length).toBe(2);

    requests.forEach(request => {
      const ids = (request.request.url.match(/[?&]id=([^&]+)/)?.[1] || '').split(',');
      expect(ids.length).toBeLessThanOrEqual(50);
      request.flush({
        items: [...ids].reverse().map(id => ({
          id,
          snippet: { title: `Title ${id}`, channelTitle: `Creator ${id}` }
        }))
      });
    });

    expect(result.length).toBe(64);
    expect(result[0]).toEqual({ title: 'Title video-1', creator: 'Creator video-1' });
    expect(result[63]).toEqual({ title: 'Title video-64', creator: 'Creator video-64' });
  });
});
