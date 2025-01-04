import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Lofi Radio';
  description = 'Lofi radio streams for you to relax and study to.';
  randomImage: string = './assets/image/lofi.jpeg'; 

  private API_KEY = environment.apikey;

  player: any;
  isPlaying: boolean = false;

  videoIds: string[] = [
    'jfKfPfyJRdk',  
    '4xDzrJKXOOY',  
    'HuFYqnbVbzY',  
    '28KRPhVzCus',  
    'Na0w3Mz46GA',  
    'rPjez8z61rI',  
    '7NOSDKb0HlU',  
    'N_7cSl2oq3o',  
  ];

  currentIndex: number = 0;
  currentVideoId: string = this.videoIds[this.currentIndex];
  currentVideoTitle: string = '';

  volume: number = 50;

  constructor(private titleService: Title,
    private metaService: Meta,
    private cdRef: ChangeDetectorRef) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);
  }

  ngOnInit(): void {
    this.fetchRandomImage();
    this.setVolume(50);
  }

  ngAfterViewInit() {
    this.loadYouTubePlayer();
  }

  ngOnDestroy() {
    if (this.player) {
      this.player.destroy();
    }
  }

  setDocTitle(title: string) {
    this.titleService.setTitle(title);
  }

  setMetaDescription(description: string) {
    this.metaService.updateTag({ name: 'description', content: description });
  }

  async fetchRandomImage() {
    try {
      const queries = ['abstract', 'aesthetic', 'nature', 'cityscape', 'landscape', 'space', 'music', 'art', 'purple', 'vintage', 'pixel art'];
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];
  
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${randomQuery}&orientation=landscape&per_page=1&page=${this.getRandomPage()}`,
        {
          headers: { Authorization: this.API_KEY },
        }
      );
  
      if (!response.ok) {
        throw new Error('Failed to fetch image from Pexels API');
      }
  
      const data = await response.json();
  
      if (data.photos && data.photos.length > 0) {
        const randomPhoto = data.photos[0];
        this.randomImage = randomPhoto.src.large2x;
      } else {
        console.error('No images found');
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  }

  private getRandomPage(): number {
    const maxPages = 20;
    return Math.floor(Math.random() * maxPages) + 1;
  }

  changeBackground() {
    this.fetchRandomImage();
    this.loadYouTubePlayer();
  }

  loadYouTubePlayer() {
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
      console.error('API do YouTube não carregada corretamente.');
      return;
    }
  
    if (this.player) {
      this.player.loadVideoById(this.videoIds[this.currentIndex]);
      this.updateVideoTitle(); 
    } else {
      this.player = new YT.Player('youtube-player', {
        videoId: this.videoIds[this.currentIndex],
        events: {
          onReady: (event: any) => this.onPlayerReady(event),
          onStateChange: (event: any) => this.onPlayerStateChange(event),
        },
      });
    }
  }  

  onPlayerReady(event: any): void {
    console.log('Player está pronto');
    this.isPlaying = false;
    this.updateVideoTitle();

    if (this.player) {
      this.player.setVolume(this.volume); 
    }
    
    const playerIframe = document.getElementById('youtube-player');
    if (playerIframe) {
      playerIframe.style.visibility = 'hidden'; 
      playerIframe.style.height = '0';           
      playerIframe.style.width = '0';            
    }
  }  

  updateVideoTitle() {
    if (this.player) {
      const videoData = this.player.getVideoData();
      if (videoData && videoData.title) {
        this.currentVideoTitle = videoData.title;
        console.log('Título do vídeo:', this.currentVideoTitle);
        this.cdRef.detectChanges(); 
      } else {
        console.warn('Título do vídeo não disponível ainda.');
        this.waitForPlayer(); 
      }
    } else {
      console.warn('Player ainda não está pronto.');
      this.waitForPlayer(); 
    }
  }
  
  waitForPlayer() {
    const interval = setInterval(() => {
      if (this.player && this.player.getVideoData()) {
        this.updateVideoTitle(); 
        clearInterval(interval); 
      }
    }, 100); 
  }  

  onPlayerStateChange(event: any): void {
    console.log('Estado do player mudou:', event.data);
    
    if (event.data === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
    } else if (event.data === YT.PlayerState.PAUSED) {
      this.isPlaying = false;
    }
  }

  togglePlayPause(): void {
    if (this.isPlaying) {
      this.player.pauseVideo(); 
    } else {
      this.player.playVideo();  
    }
  }

  nextVideo(): void {
    if (this.currentIndex < this.videoIds.length - 1) {
      this.currentIndex++;
      this.currentVideoId = this.videoIds[this.currentIndex];
      this.changeBackground();
    } else {
      this.currentIndex = 0; 
      this.currentVideoId = this.videoIds[this.currentIndex];
      this.changeBackground();
    }
  }

  previousVideo(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentVideoId = this.videoIds[this.currentIndex];
      this.changeBackground();
    } else {
      this.currentIndex = this.videoIds.length - 1; 
      this.currentVideoId = this.videoIds[this.currentIndex];
      this.changeBackground();
    }
  }

  setVolume(value: number): void {
    if (this.player) {
      this.player.setVolume(value); 
      console.log('Alterando volume para:', value);
    }
  }
}
