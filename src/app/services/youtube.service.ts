import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class YoutubeService {
  private apiKey = environment.youtubeapikey;
  private apiUrl = 'https://www.googleapis.com/youtube/v3/videos';

  constructor(private http: HttpClient) {}

  getVideoTitle(videoId: string) {
    const url = `${this.apiUrl}?id=${videoId}&key=${this.apiKey}&part=snippet`;
    return this.http.get<any>(url).pipe(
      map((response) => {
        if (response.items.length > 0) {
          return response.items[0].snippet.title;
        }
        return 'Título não encontrado';
      })
    );
  }
}
