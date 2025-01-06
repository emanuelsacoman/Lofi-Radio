import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { PexelsService } from 'src/app/services/pexels.service';
import { UserService } from 'src/app/services/user.service';
import { environment } from 'src/environments/environment';

type Palette = {
  [key: string]: { [variable: string]: string };
};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Lofi Radio';
  description = 'Lofi radio streams for you to relax and study to.';
  randomImage: string = './assets/image/lofi.jpeg';
  player: any;
  isPlaying: boolean = false;
  connectedUsersCount: number = 0;
  videoIds: string[] = [
    'jfKfPfyJRdk',
    '4xDzrJKXOOY',
    'HuFYqnbVbzY',
    '28KRPhVzCus',
    'Na0w3Mz46GA',
    'rPjez8z61rI',
    '7NOSDKb0HlU',
    'N_7cSl2oq3o',
    'ralJmHG-DII',
    'erUTqlcsDJI',
    'TfmECBzmOn4',
    '7p41rWD3s-c',
    'techmgGVOhk',
    'TfYBaIsVzhs',
    'p53rW6sMfqw',
    'RrkrdYm3HPQ',
    '0p6UidTS7Ao',
  ];
  currentIndex: number = 0;
  totalVideos: number = this.videoIds.length;
  currentVideoId: string = this.videoIds[this.currentIndex];
  currentVideoTitle: string = '';
  currentVideoOwner: string = ''; 
  volume: number = 50;

  palettes: Palette = {
    purple: {
      '--clr-background': '#1f1e30',
      '--clr-primary': '#aea4d3',
      '--clr-secondary': '#4b3470',
      '--clr-accent': '#805cb1',
      '--clr-accent-light': '#707cb5',
      '--clr-text': '#eff1e4',
    },
    blue: {
      '--clr-background': '#191831',
      '--clr-primary': '#544cca',
      '--clr-secondary': '#343670',
      '--clr-accent': '#605cb1',
      '--clr-accent-light': '#3d9970',
      '--clr-text': '#e4e7f1',
    },
    green: {
      '--clr-background': '#081c15',
      '--clr-primary': '#4cca4e',
      '--clr-secondary': '#34703c',
      '--clr-accent': '#5cb167',
      '--clr-accent-light': '#70b580',
      '--clr-text': '#e4f1e5',
    },
    cafe: {
      '--clr-background': '#312818',
      '--clr-primary': '#caa04c',
      '--clr-secondary': '#704e34',
      '--clr-accent': '#b1855c',
      '--clr-accent-light': '#b59c70',
      '--clr-text': '#f1ece4',
    },
    gray: {
      '--clr-background': '#322f2a',
      '--clr-primary': '#d3c8b2',
      '--clr-secondary': '#d3c8b2',
      '--clr-accent': '#b9b09f',
      '--clr-accent-light': '#b9b09f',
      '--clr-text': '#d6d3cd',
    },
  };

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private cdRef: ChangeDetectorRef,
    private pexelsService: PexelsService,
    private userService: UserService
  ) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);
  }

  ngOnInit(): void {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      this.setVolume(parseInt(savedVolume, 10));
    } else {
      this.setVolume(50); 
    }
    
    this.loadRandomImage();
    this.fetchConnectedUsersCount();

    const savedPalette = localStorage.getItem('selectedPalette') || 'purple';
    this.setTheme(savedPalette);

    const savedVideoId = localStorage.getItem('currentVideoId');
    if (savedVideoId && this.videoIds.includes(savedVideoId)) {
      this.currentIndex = this.videoIds.indexOf(savedVideoId);
      this.currentVideoId = savedVideoId;
    } else {
      this.currentVideoId = this.videoIds[this.currentIndex];
    }

    this.fetchVideoOwnerInfo(this.currentVideoId);
  }

  fetchConnectedUsersCount() {
    this.userService.getConnectedUsersCount().subscribe(count => {
      this.connectedUsersCount = count;
    });
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

  async loadRandomImage() {
    const image = await this.pexelsService.fetchRandomImage();
    if (image) {
      this.randomImage = image;
    }
  }

  changeBackground() {
    this.loadRandomImage();
    this.loadYouTubePlayer();
  }

  loadYouTubePlayer() {
    const maxRetries = 10;
    let retryCount = 0;
    const retryInterval = 500;

    const initializePlayer = () => {
      if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializePlayer, retryInterval);
        }
        return;
      }

      if (this.player) {
        this.player.loadVideoById(this.videoIds[this.currentIndex]);
        this.updateVideoTitle();
        this.fetchVideoOwnerInfo(this.videoIds[this.currentIndex]); 
      } else {
        this.player = new YT.Player('youtube-player', {
          videoId: this.videoIds[this.currentIndex],
          events: {
            onReady: event => this.onPlayerReady(event),
            onStateChange: event => this.onPlayerStateChange(event),
          },
        });
      }
    };

    initializePlayer();
  }

  fetchVideoOwnerInfo(videoId: string) {
    const API_KEY = environment.youtubeapikey; 
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.items && data.items.length > 0) {
          const channelTitle = data.items[0].snippet.channelTitle;
          this.updateVideoOwner(channelTitle);
        }
      })
      .catch(error => console.error('Erro ao obter informações do vídeo:', error));
  }

  updateVideoOwner(channelName: string) {
    this.currentVideoOwner = channelName; 
    console.log('Dono do vídeo:', channelName);
  }

  onPlayerReady(event: any): void {
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
        this.cdRef.detectChanges();
      } else {
        this.waitForPlayer();
      }
    } else {
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
    if (event.data === YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      localStorage.setItem('currentVideoId', this.videoIds[this.currentIndex]);
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
    } else {
      this.currentIndex = 0;
    }
    this.currentVideoId = this.videoIds[this.currentIndex];
    localStorage.setItem('currentVideoId', this.currentVideoId);
    this.changeBackground();
  }

  previousVideo(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.videoIds.length - 1;
    }
    this.currentVideoId = this.videoIds[this.currentIndex];
    localStorage.setItem('currentVideoId', this.currentVideoId);
    this.changeBackground();
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.player) {
      this.player.setVolume(value);
    }

    localStorage.setItem('volume', value.toString());
  }

  setTheme(paletteKey: string) {
    const palette = this.palettes[paletteKey as keyof typeof this.palettes];
    if (palette) {
      Object.entries(palette).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      localStorage.setItem('selectedPalette', paletteKey);
    }
  }
}
