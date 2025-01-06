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
      'vintage', 'pixel art', 'medieval', 'flowers', 'garden', 'ambient', 'sky', 'mountain', 'rain', 'clouds', 
      'fantasy', 'cyberpunk', 'steampunk', 'retro', 'futuristic', 'technology', 'dark', 'light', 'minimalist', 
      'surreal', 'pop art', 'cartoon', 'anime', 'forest', 'ocean', 'sea', 'waterfall', 'sunset', 'sunrise', 
      'desert', 'cave', 'castle', 'robot', 'alien', 'galaxy', 'stars', 'planet', 'underwater', 'nebula', 
      'vaporwave', 'synthwave', 'neon', 'urban', 'rural', 'village', 'ruins', 'industrial', 'mechanical', 
      'woodland', 'autumn', 'winter', 'spring', 'summer', 'tropical', 'island', 'snow', 'fire', 'lightning', 
      'storm', 'horizon', 'wildlife', 'birds', 'animals', 'wolves', 'dragons', 'magic', 'spiritual', 'haunted', 
      'ethereal', 'gold', 'silver', 'bronze', 'crystals', 'jungle', 'path', 'bridge', 'skyline', 'city lights', 
      'rainforest', 'meadow', 'field', 'flowers', 'roses', 'daisies', 'butterflies', 'moonlight', 'night', 
      'day', 'dawn', 'dusk', 'street', 'marketplace', 'festival', 'carnival', 'balloons', 'kites', 'water', 
      'ice', 'fireworks', 'fairy', 'witch', 'wizard', 'alchemy', 'spacecraft', 'exploration', 'adventure', 
      'epic', 'mystery', 'mythology', 'temple', 'pyramids', 'culture', 'artifacts', 'treasure', 'cliff', 
      'valley', 'hills', 'cloudy', 'fog', 'mist', 'rainbow', 'reflection', 'rivers', 'streams', 'waves', 
      'coral', 'deep sea', 'wild', 'chaotic', 'orderly', 'pattern', 'ornament', 'geometric', 'sacred', 
      'harmony', 'balance', 'contrast', 'gradient', 'colorful', 'monochrome', 'sepia', 'pastel', 'bright', 
      'glow', 'shine', 'luminous', 'energy', 'power', 'calm', 'peaceful', 'serene', 'tranquil', 'dynamic', 
      'action', 'movement', 'stillness', 'shadow', 'shade', 'texture', 'fabric', 'glass', 'mirror', 
      'reflection', 'waves', 'stone', 'marble', 'granite', 'architecture', 'modern', 'classic', 'ancient'
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
