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
  ];

  currentIndex: number = 0;
  currentVideoId: string = this.videoIds[this.currentIndex];
  currentVideoTitle: string = '';

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
  };

  constructor(private titleService: Title,
    private metaService: Meta,
    private cdRef: ChangeDetectorRef,
    private pexelsService: PexelsService,
    private userService: UserService) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);
  }

  ngOnInit(): void {
    this.setVolume(50);
    this.loadRandomImage();
    this.fetchConnectedUsersCount();

    const savedPalette = localStorage.getItem('selectedPalette') || 'purple';
    this.setTheme(savedPalette);
  }

  fetchConnectedUsersCount() {
    this.userService.getConnectedUsersCount().subscribe(count => {
      this.connectedUsersCount = count;
      console.log('Número de visitantes conectados:', this.connectedUsersCount);
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
    } else {
      console.error('Erro ao carregar imagem. Usando imagem padrão.');
    }
  }

  changeBackground() {
    
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
          console.warn(`Tentativa ${retryCount} de ${maxRetries}: API do YouTube não carregada ainda.`);
          setTimeout(initializePlayer, retryInterval);
        } else {
          console.error('API do YouTube não carregada corretamente após várias tentativas.');
        }
        return;
      }
  
      if (this.player) {
        this.player.loadVideoById(this.videoIds[this.currentIndex]);
        this.updateVideoTitle();
        this.loadRandomImage();
      } else {
        this.player = new YT.Player('youtube-player', {
          videoId: this.videoIds[this.currentIndex],
          events: {
            onReady: (event) => this.onPlayerReady(event),
            onStateChange: (event) => this.onPlayerStateChange(event),
          },
        });
      }
    };
  
    initializePlayer();
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

  setTheme(paletteKey: string) {
    const palette = this.palettes[paletteKey as keyof typeof this.palettes];
    if (palette) {
      Object.entries(palette).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value as string);
      });
      localStorage.setItem('selectedPalette', paletteKey);
    }
  }
  
}
