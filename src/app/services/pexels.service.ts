import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PexelsService {
  private API_KEY = environment.apikey;

  constructor() {}

  async fetchRandomImage(): Promise<string | null> {
    const queries = [
      'abstract', 'aesthetic', 'nature', 'cityscape', 'landscape', 'space', 'music', 'art', 'purple', 
      'vintage', 'pixel art', 'flowers', 'garden', 'ambient', 'sky', 'rain', 'clouds', 'fantasy', 
      'retro', 'minimalist', 'cartoon', 'anime', 'forest', 'ocean', 'sea', 'waterfall', 'sunset', 
      'sunrise', 'neon', 'urban', 'rural', 'village', 'autumn', 'winter', 'spring', 'summer', 
      'tropical', 'island', 'rain', 'fire', 'storm', 'horizon', 'wildlife', 'birds', 'animals', 
      'magic', 'spiritual', 'ethereal', 'path', 'bridge', 'skyline', 'city lights', 'rainforest', 
      'meadow', 'field', 'flowers', 'roses', 'daisies', 'butterflies', 'moonlight', 'night', 
      'day', 'dawn', 'dusk', 'street', 'marketplace', 'festival', 'cloudy', 'fog', 'mist', 
      'rainbow', 'reflection', 'rivers', 'streams', 'waves', 'peaceful', 'serene', 'tranquil', 
      'shadow', 'shade', 'texture', 'stone', 'architecture', 'modern', 'classic'
    ];    
    
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    const maxPages = 50;
    const randomPage = Math.floor(Math.random() * maxPages) + 1;

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${randomQuery}&orientation=landscape&per_page=1&page=${randomPage}`,
        { headers: { Authorization: this.API_KEY } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch image from Pexels API');
      }

      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        return data.photos[0].src.large2x;
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
    return null;
  }
}
