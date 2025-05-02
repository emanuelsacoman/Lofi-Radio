import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface YouTubeVideoDetails {
  title: string;
  creator: string;
}

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  private apiKey = environment.youtubeapikey;
  private apiUrl = 'https://www.googleapis.com/youtube/v3/videos';
  private quotaKey = 'yt-api-quota-status';
  private detailsCache = new Map<string, YouTubeVideoDetails>();
  private inFlightRequests = new Map<string, Observable<YouTubeVideoDetails>>();

  constructor(private http: HttpClient) {}

  getVideoDetails(videoId: string): Observable<YouTubeVideoDetails> {
    const mem = this.detailsCache.get(videoId);
    if (mem) return of(mem);

    const ongoing = this.inFlightRequests.get(videoId);
    if (ongoing) return ongoing;

    const stored = localStorage.getItem(`yt-details-${videoId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as YouTubeVideoDetails;
      this.detailsCache.set(videoId, parsed);
      return of(parsed);
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
        tap(details => {
          this.detailsCache.set(videoId, details);
          localStorage.setItem(`yt-details-${videoId}`, JSON.stringify(details));
        }),
        catchError(err => {
          if (err.error?.errors?.[0]?.reason === 'quotaExceeded') {
            localStorage.setItem(this.quotaKey, 'Quota exceeded, try again later.');
          }
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
    const uncached = videoIds.filter(id => !this.detailsCache.has(id));
    if (uncached.length === 0) {
      return of(videoIds.map(id => this.detailsCache.get(id)!));
    }

    const url = `${this.apiUrl}?id=${uncached.join(',')}&key=${this.apiKey}&part=snippet`;
    return this.http.get<any>(url).pipe(
      map(res => {
        for (const item of res.items || []) {
          const id = item.id as string;
          const d = { title: item.snippet.title, creator: item.snippet.channelTitle };
          this.detailsCache.set(id, d);
          localStorage.setItem(`yt-details-${id}`, JSON.stringify(d));
        }
        return videoIds.map(id =>
          this.detailsCache.get(id) || { title: 'Temporarily unavailable', creator: 'Unknown' }
        );
      }),
      catchError(() =>
        of(videoIds.map(() => ({ title: 'Temporarily unavailable', creator: 'Unknown' })))
      )
    );
  }

  getQuotaStatus(): Observable<string> {
    const status = localStorage.getItem(this.quotaKey);
    return of(status ?? 'Quota status not available');
  }
}
