import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class YoutubeService {
  private apiKey = environment.youtubeapikey;
  private apiUrl = 'https://www.googleapis.com/youtube/v3/videos';
  private quotaKey = 'yt-api-quota-status';  // Chave para armazenar status da cota no localStorage

  constructor(private http: HttpClient) {}

  private getFromCache(videoId: string): string | null {
    const cached = localStorage.getItem(`yt-title-${videoId}`);
    return cached ? cached : null;
  }

  private saveToCache(videoId: string, title: string) {
    localStorage.setItem(`yt-title-${videoId}`, title);
  }

  private getQuotaStatusFromCache(): string | null {
    return localStorage.getItem(this.quotaKey);
  }

  private saveQuotaStatusToCache(status: string) {
    localStorage.setItem(this.quotaKey, status);
  }

  getVideoTitle(videoId: string) {
    const cachedTitle = this.getFromCache(videoId);
    if (cachedTitle) {
      return of(cachedTitle);
    }

    const url = `${this.apiUrl}?id=${videoId}&key=${this.apiKey}&part=snippet`;
    return this.http.get<any>(url).pipe(
      map((response) => {
        if (response.items && response.items.length > 0) {
          const title = response.items[0].snippet.title;
          this.saveToCache(videoId, title);
          return title;
        }
        return 'Temporarily unavailable';
      }),
      catchError((error) => {
        if (error.error.errors && error.error.errors[0].reason === 'quotaExceeded') {
          this.saveQuotaStatusToCache('Quota exceeded, try again later.');
        }
        return of('Temporarily unavailable');
      })
    );
  }

  getQuotaStatus(): Observable<string> {
    const status = this.getQuotaStatusFromCache();
    return of(status ? status : 'Quota status not available');
  }

  resetQuotaStatus() {
    this.saveQuotaStatusToCache('Quota reset expected at midnight UTC.');
  }
}
