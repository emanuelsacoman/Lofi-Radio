import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { YoutubeService } from './youtube.service';

describe('YoutubeService', () => {
  let service: YoutubeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(YoutubeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

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

  it('hydrates batch details from browser cache without another API request', () => {
    localStorage.setItem('yt-details-video-a', JSON.stringify({
      title: 'Cached title',
      creator: 'Cached creator',
      cachedAt: Date.now()
    }));
    let result: Array<{ title: string; creator: string }> = [];

    service.getVideoDetailsBatch(['video-a']).subscribe(details => result = details);

    expect(httpTesting.match(request => request.url.includes('/youtube/v3/videos'))).toEqual([]);
    expect(result).toEqual([{ title: 'Cached title', creator: 'Cached creator' }]);
  });

  it('refreshes legacy, expired, and unavailable cache entries', () => {
    localStorage.setItem('yt-details-legacy', JSON.stringify({
      title: 'Legacy title',
      creator: 'Legacy creator'
    }));
    localStorage.setItem('yt-details-expired', JSON.stringify({
      title: 'Expired title',
      creator: 'Expired creator',
      cachedAt: Date.now() - (25 * 60 * 60 * 1000)
    }));
    localStorage.setItem('yt-details-unavailable', JSON.stringify({
      title: 'Temporarily unavailable',
      creator: 'Unknown',
      cachedAt: Date.now()
    }));
    let result: Array<{ title: string; creator: string }> = [];

    service.getVideoDetailsBatch(['legacy', 'expired', 'unavailable'])
      .subscribe(details => result = details);

    const request = httpTesting.expectOne(value => value.url.includes('/youtube/v3/videos'));
    request.flush({
      items: ['legacy', 'expired', 'unavailable'].map(id => ({
        id,
        snippet: { title: `Fresh ${id}`, channelTitle: `Creator ${id}` }
      }))
    });

    expect(result.map(details => details.title)).toEqual([
      'Fresh legacy',
      'Fresh expired',
      'Fresh unavailable'
    ]);
  });

  it('expires in-memory details during a long-running session', () => {
    let now = 1_700_000_000_000;
    spyOn(Date, 'now').and.callFake(() => now);

    service.getVideoDetailsBatch(['video-a']).subscribe();
    httpTesting.expectOne(value => value.url.includes('/youtube/v3/videos')).flush({
      items: [{
        id: 'video-a',
        snippet: { title: 'Initial title', channelTitle: 'Initial creator' }
      }]
    });

    now += 25 * 60 * 60 * 1000;
    let refreshedTitle = '';
    service.getVideoDetailsBatch(['video-a'])
      .subscribe(details => refreshedTitle = details[0].title);
    httpTesting.expectOne(value => value.url.includes('/youtube/v3/videos')).flush({
      items: [{
        id: 'video-a',
        snippet: { title: 'Refreshed title', channelTitle: 'Refreshed creator' }
      }]
    });

    expect(refreshedTitle).toBe('Refreshed title');
  });

  it('ignores malformed browser cache and refreshes it from the API', () => {
    localStorage.setItem('yt-details-video-a', '{broken-json');
    let result: Array<{ title: string; creator: string }> = [];

    expect(() => {
      service.getVideoDetailsBatch(['video-a']).subscribe(details => result = details);
    }).not.toThrow();

    const request = httpTesting.expectOne(value => value.url.includes('/youtube/v3/videos'));
    request.flush({
      items: [{
        id: 'video-a',
        snippet: { title: 'Fresh title', channelTitle: 'Fresh creator' }
      }]
    });

    expect(result).toEqual([{ title: 'Fresh title', creator: 'Fresh creator' }]);
  });

  it('recognizes the nested YouTube quota error payload', () => {
    let status = '';

    service.getVideoDetails('video-a').subscribe();
    httpTesting.expectOne(value => value.url.includes('/youtube/v3/videos')).flush(
      { error: { errors: [{ reason: 'quotaExceeded' }] } },
      { status: 403, statusText: 'Forbidden' }
    );
    service.getQuotaStatus().subscribe(value => status = value);

    expect(status).toBe('Quota exceeded, try again later.');
  });
});
