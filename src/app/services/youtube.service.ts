import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface YouTubeVideoDetails {
  title: string;
  creator: string;
}

export interface YouTubeChannelDetails {
  channelId: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
}

export interface YouTubeLiveVideo {
  videoId: string;
  title: string;
  creator: string;
  channelId: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

export interface YouTubeVideoHealth {
  videoId: string;
  isWorking: boolean;
}

type StoredYouTubeVideoDetails = YouTubeVideoDetails & {
  cachedAt: number;
};

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  private apiKey = environment.youtubeapikey;
  private apiUrl = 'https://www.googleapis.com/youtube/v3/videos';
  private channelsApiUrl = 'https://www.googleapis.com/youtube/v3/channels';
  private searchApiUrl = 'https://www.googleapis.com/youtube/v3/search';
  private quotaKey = 'yt-api-quota-status';
  private readonly detailsCacheTtlMs = 24 * 60 * 60 * 1000;
  private detailsCache = new Map<string, StoredYouTubeVideoDetails>();
  private inFlightRequests = new Map<string, Observable<YouTubeVideoDetails>>();
  private channelCache = new Map<string, YouTubeChannelDetails>();

  constructor(private http: HttpClient) {}

  getVideoDetails(videoId: string): Observable<YouTubeVideoDetails> {
    const mem = this.readMemoryVideoDetails(videoId);
    if (mem) return of(mem);

    const ongoing = this.inFlightRequests.get(videoId);
    if (ongoing) return ongoing;

    const stored = this.readStoredVideoDetails(videoId);
    if (stored) {
      this.detailsCache.set(videoId, stored);
      return of({ title: stored.title, creator: stored.creator });
    }

    const request$ = this.http
      .get<any>(`${this.apiUrl}?id=${videoId}&key=${this.apiKey}&part=snippet`)
      .pipe(
        map(res => {
          if (res.items?.length) {
            const sn = res.items[0].snippet;
            return { title: sn.title, creator: sn.channelTitle };
          }
          return { title: 'Temporarily unavailable', creator: 'Unknown' };
        }),
        tap(details => this.cacheVideoDetails(videoId, details)),
        catchError(err => {
          this.rememberQuotaStatus(err);
          return of({ title: 'Temporarily unavailable', creator: 'Unknown' });
        }),
        shareReplay(1)
      );

    this.inFlightRequests.set(videoId, request$);
    request$.subscribe({
      next: () => this.inFlightRequests.delete(videoId),
      error: () => this.inFlightRequests.delete(videoId)
    });

    return request$;
  }

  getVideoTitle(videoId: string): Observable<string> {
    return this.getVideoDetails(videoId).pipe(map(d => d.title));
  }

  getVideoDetailsBatch(videoIds: string[]): Observable<YouTubeVideoDetails[]> {
    const uniqueVideoIds = Array.from(new Set(videoIds.filter(Boolean)));

    uniqueVideoIds.forEach(videoId => {
      if (!this.readMemoryVideoDetails(videoId)) {
        const stored = this.readStoredVideoDetails(videoId);

        if (stored) {
          this.detailsCache.set(videoId, stored);
        }
      }
    });

    const uncached = uniqueVideoIds.filter(id => !this.readMemoryVideoDetails(id));

    if (!uncached.length) {
      return of(this.readCachedVideoDetails(videoIds));
    }

    const requests = this.chunk(uncached, 50).map(chunk => {
      const url = `${this.apiUrl}?id=${chunk.join(',')}&key=${this.apiKey}&part=snippet`;

      return this.http.get<any>(url).pipe(
        tap(res => {
          for (const item of res.items || []) {
            const id = item.id as string;
            const details = { title: item.snippet.title, creator: item.snippet.channelTitle };
            this.cacheVideoDetails(id, details);
          }
        }),
        catchError(err => {
          this.rememberQuotaStatus(err);
          return of(null);
        })
      );
    });

    return forkJoin(requests).pipe(
      map(() => this.readCachedVideoDetails(videoIds))
    );
  }

  resolveChannel(input: string): Observable<YouTubeChannelDetails> {
    const channelInput = this.normalizeChannelInput(input);

    if (channelInput.channelId) {
      return this.getChannelByParams(
        { id: channelInput.channelId },
        `id:${channelInput.channelId}`
      );
    }

    if (channelInput.handle) {
      return this.getChannelByParams(
        { forHandle: channelInput.handle },
        `handle:${channelInput.handle}`
      ).pipe(catchError(() => this.searchChannel(channelInput.query)));
    }

    if (channelInput.username) {
      return this.getChannelByParams(
        { forUsername: channelInput.username },
        `username:${channelInput.username}`
      ).pipe(catchError(() => this.searchChannel(channelInput.query)));
    }

    return this.searchChannel(channelInput.query);
  }

  getCurrentLivesForChannel(channelId: string): Observable<YouTubeLiveVideo[]> {
    const params = this.buildParams({
      part: 'snippet',
      channelId,
      eventType: 'live',
      maxResults: '50',
      type: 'video'
    });

    return this.http.get<any>(this.searchApiUrl, { params }).pipe(
      map(res => (res.items || [])
        .map((item: any) => this.mapLiveVideo(item))
        .filter((live: YouTubeLiveVideo | null): live is YouTubeLiveVideo => !!live)
      ),
      tap((lives: YouTubeLiveVideo[]) => {
        lives.forEach(live => {
          this.cacheVideoDetails(live.videoId, {
            title: live.title,
            creator: live.creator
          });
        });
      }),
      catchError(err => {
        this.rememberQuotaStatus(err);
        return of([]);
      })
    );
  }

  getCurrentLivesForChannels(channelIds: string[]): Observable<YouTubeLiveVideo[]> {
    const uniqueChannelIds = Array.from(new Set(channelIds.filter(Boolean)));

    if (!uniqueChannelIds.length) {
      return of([]);
    }

    return forkJoin(uniqueChannelIds.map(channelId => this.getCurrentLivesForChannel(channelId))).pipe(
      map(groups => {
        const lives = groups.flat();
        const seen = new Set<string>();
        return lives.filter(live => {
          if (seen.has(live.videoId)) {
            return false;
          }
          seen.add(live.videoId);
          return true;
        });
      })
    );
  }

  getNonWorkingLiveVideoIds(videoIds: string[]): Observable<string[]> {
    const uniqueVideoIds = Array.from(new Set(videoIds.filter(Boolean)));

    if (!uniqueVideoIds.length) {
      return of([]);
    }

    const chunks = this.chunk(uniqueVideoIds, 50);

    return forkJoin(chunks.map(chunk => this.getVideoHealthChunk(chunk))).pipe(
      map(groups => groups
        .flat()
        .filter(health => !health.isWorking)
        .map(health => health.videoId)
      )
    );
  }

  private getChannelByParams(
    paramsObject: Record<string, string>,
    cacheKey: string
  ): Observable<YouTubeChannelDetails> {
    const cached = this.channelCache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = this.buildParams({ part: 'snippet', ...paramsObject });

    return this.http.get<any>(this.channelsApiUrl, { params }).pipe(
      map(res => this.readChannelFromResponse(res)),
      tap(channel => {
        this.channelCache.set(cacheKey, channel);
        this.channelCache.set(`id:${channel.channelId}`, channel);
      }),
      catchError(err => {
        this.rememberQuotaStatus(err);
        return throwError(() => new Error('Canal não encontrado.'));
      })
    );
  }

  private searchChannel(query: string): Observable<YouTubeChannelDetails> {
    const params = this.buildParams({
      part: 'snippet',
      maxResults: '1',
      q: query,
      type: 'channel'
    });

    return this.http.get<any>(this.searchApiUrl, { params }).pipe(
      map(res => this.readChannelFromSearchResponse(res)),
      tap(channel => {
        this.channelCache.set(`id:${channel.channelId}`, channel);
        this.channelCache.set(`search:${query.toLowerCase()}`, channel);
      }),
      catchError(err => {
        this.rememberQuotaStatus(err);
        return throwError(() => new Error('Canal não encontrado.'));
      })
    );
  }

  private readChannelFromResponse(res: any): YouTubeChannelDetails {
    const item = res.items?.[0];
    if (!item?.id || !item?.snippet) {
      throw new Error('Canal não encontrado.');
    }

    return {
      channelId: item.id,
      title: item.snippet.title,
      handle: item.snippet.customUrl,
      thumbnailUrl: this.getBestThumbnail(item.snippet.thumbnails)
    };
  }

  private readChannelFromSearchResponse(res: any): YouTubeChannelDetails {
    const item = res.items?.[0];
    const channelId = item?.id?.channelId;

    if (!channelId || !item?.snippet) {
      throw new Error('Canal não encontrado.');
    }

    return {
      channelId,
      title: item.snippet.title,
      handle: item.snippet.customUrl,
      thumbnailUrl: this.getBestThumbnail(item.snippet.thumbnails)
    };
  }

  private mapLiveVideo(item: any): YouTubeLiveVideo | null {
    const videoId = item?.id?.videoId;
    const snippet = item?.snippet;

    if (!videoId || !snippet) {
      return null;
    }

    return {
      videoId,
      title: snippet.title,
      creator: snippet.channelTitle,
      channelId: snippet.channelId,
      thumbnailUrl: this.getBestThumbnail(snippet.thumbnails),
      publishedAt: snippet.publishedAt
    };
  }

  private getVideoHealthChunk(videoIds: string[]): Observable<YouTubeVideoHealth[]> {
    const params = this.buildParams({
      id: videoIds.join(','),
      part: 'snippet,status,liveStreamingDetails'
    });

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(res => {
        const items = res.items || [];

        if (!items.length && videoIds.length > 1) {
          throw new Error('A API nao retornou dados suficientes para uma limpeza segura.');
        }

        const itemsById = new Map<string, any>();

        items.forEach((item: any) => {
          if (item.id) {
            itemsById.set(item.id, item);
          }
        });

        return videoIds.map(videoId => ({
          videoId,
          isWorking: this.isVideoWorking(itemsById.get(videoId))
        }));
      }),
      catchError(err => {
        this.rememberQuotaStatus(err);
        return throwError(() => new Error('Nao foi possivel verificar as lives.'));
      })
    );
  }

  private isVideoWorking(item: any): boolean {
    if (!item) {
      return false;
    }

    const status = item.status;

    if (status?.privacyStatus && status.privacyStatus !== 'public') {
      return false;
    }

    if (status?.embeddable === false) {
      return false;
    }

    if (['deleted', 'failed', 'rejected'].includes(status?.uploadStatus)) {
      return false;
    }

    const liveDetails = item.liveStreamingDetails;

    if (!liveDetails) {
      return true;
    }

    if (liveDetails.actualEndTime) {
      return false;
    }

    return true;
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  private normalizeChannelInput(input: string): {
    channelId?: string;
    handle?: string;
    username?: string;
    query: string;
  } {
    const value = input.trim();
    const directChannelId = value.match(/^(UC[\w-]{22})$/i)?.[1];

    if (directChannelId) {
      return { channelId: directChannelId, query: directChannelId };
    }

    const rawHandle = value.match(/^@([\w.-]+)$/)?.[1];
    if (rawHandle) {
      return { handle: `@${rawHandle}`, query: rawHandle };
    }

    const parsedUrl = this.parseChannelUrl(value);
    if (parsedUrl) {
      return parsedUrl;
    }

    const likelyHandle = value.match(/^[\w.-]+$/)?.[0];
    if (likelyHandle) {
      return { handle: likelyHandle, query: likelyHandle };
    }

    return { query: value };
  }

  private parseChannelUrl(value: string): {
    channelId?: string;
    handle?: string;
    username?: string;
    query: string;
  } | null {
    const urlValue = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    try {
      const url = new URL(urlValue);
      const host = url.hostname.replace(/^www\./, '');

      if (!host.endsWith('youtube.com')) {
        return null;
      }

      const segments = url.pathname.split('/').filter(Boolean);
      const firstSegment = segments[0];
      const secondSegment = segments[1];

      if (!firstSegment) {
        return null;
      }

      if (firstSegment === 'channel' && secondSegment) {
        return { channelId: secondSegment, query: secondSegment };
      }

      if (firstSegment.startsWith('@')) {
        const handle = firstSegment;
        return { handle, query: handle.replace('@', '') };
      }

      if (firstSegment === 'user' && secondSegment) {
        return { username: secondSegment, query: secondSegment };
      }

      if (firstSegment === 'c' && secondSegment) {
        return { query: secondSegment };
      }

      return { query: firstSegment };
    } catch {
      return null;
    }
  }

  private getBestThumbnail(thumbnails: any): string | undefined {
    return thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url;
  }

  private buildParams(paramsObject: Record<string, string>): HttpParams {
    let params = new HttpParams().set('key', this.apiKey);

    Object.entries(paramsObject).forEach(([key, value]) => {
      params = params.set(key, value);
    });

    return params;
  }

  private cacheVideoDetails(videoId: string, details: YouTubeVideoDetails): void {
    if (!this.isCacheableVideoDetails(details)) {
      this.detailsCache.delete(videoId);
      this.removeStoredVideoDetails(videoId);
      return;
    }

    const storedDetails: StoredYouTubeVideoDetails = {
      ...details,
      cachedAt: Date.now()
    };
    this.detailsCache.set(videoId, storedDetails);

    try {
      localStorage.setItem(`yt-details-${videoId}`, JSON.stringify(storedDetails));
    } catch {
      // The in-memory cache remains available when browser storage is blocked.
    }
  }

  private readStoredVideoDetails(videoId: string): StoredYouTubeVideoDetails | null {
    try {
      const stored = localStorage.getItem(`yt-details-${videoId}`);

      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as Partial<StoredYouTubeVideoDetails>;
      const isFresh = this.isFreshCacheTimestamp(parsed?.cachedAt);
      const details = {
        title: parsed?.title,
        creator: parsed?.creator
      } as Partial<YouTubeVideoDetails>;

      if (
        isFresh
        && typeof details.title === 'string'
        && typeof details.creator === 'string'
        && this.isCacheableVideoDetails(details as YouTubeVideoDetails)
      ) {
        return {
          title: details.title,
          creator: details.creator,
          cachedAt: parsed.cachedAt as number
        };
      }

      this.removeStoredVideoDetails(videoId);
    } catch {
      this.removeStoredVideoDetails(videoId);
    }

    return null;
  }

  private readCachedVideoDetails(videoIds: string[]): YouTubeVideoDetails[] {
    return videoIds.map(id =>
      this.readMemoryVideoDetails(id) || { title: 'Temporarily unavailable', creator: 'Unknown' }
    );
  }

  private readMemoryVideoDetails(videoId: string): YouTubeVideoDetails | null {
    const cached = this.detailsCache.get(videoId);

    if (!cached || !this.isFreshCacheTimestamp(cached.cachedAt)) {
      this.detailsCache.delete(videoId);
      return null;
    }

    return { title: cached.title, creator: cached.creator };
  }

  private isFreshCacheTimestamp(cachedAt: unknown): cachedAt is number {
    return typeof cachedAt === 'number'
      && Number.isFinite(cachedAt)
      && Date.now() - cachedAt <= this.detailsCacheTtlMs;
  }

  private isCacheableVideoDetails(details: YouTubeVideoDetails): boolean {
    return Boolean(
      details.title?.trim()
      && details.creator?.trim()
      && details.title !== 'Temporarily unavailable'
      && details.creator !== 'Unknown'
    );
  }

  private removeStoredVideoDetails(videoId: string): void {
    try {
      localStorage.removeItem(`yt-details-${videoId}`);
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  private rememberQuotaStatus(err: any): void {
    const errorPayload = err?.error?.error || err?.error;
    const reason = errorPayload?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      try {
        localStorage.setItem(this.quotaKey, 'Quota exceeded, try again later.');
      } catch {
        // Quota feedback remains best-effort when browser storage is blocked.
      }
    }
  }

  getQuotaStatus(): Observable<string> {
    try {
      const status = localStorage.getItem(this.quotaKey);
      return of(status ?? 'Quota status not available');
    } catch {
      return of('Quota status not available');
    }
  }
}
