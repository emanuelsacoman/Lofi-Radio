import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { EmojiService } from 'src/app/services/emoji.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { Chip } from 'src/app/services/interfaces/chip';
import { PexelsService } from 'src/app/services/pexels.service';
import { UserService } from 'src/app/services/user.service';
import { YoutubeService } from 'src/app/services/youtube.service';
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
  title = 'Lofi Radio - 24/7 Chill Beats to Relax, Study & Work';
  description = 'Lofi Radio – 24/7 Chill Beats to Relax, Study & Work. Stream Lofi, Vaporwave, Chillwave, ambience, rain sounds and more to boost your focus and unwind.';

  randomImage: string = './assets/image/loadinglofi.gif';

  player: any;
  isPlaying: boolean = false;

  connectedUsersCount: number = 0;

  isFirstLoad: boolean = true;

  public chipArray: Chip[] = [];
  videoIds: string[] = [];
  videoTitles: string[] = [];
  showList: boolean = false;

  public isFirstVisit: boolean = false; 

  public newItems: boolean[] = [];

  currentIndex: number = 0;
  totalVideos: number = this.videoIds.length;
  currentVideoId: string = this.videoIds[this.currentIndex];
  currentVideoTitle: string = '';
  currentVideoOwner: string = '';
  volume: number = 50;

  isAnimating = false;
  
  isFullScreen = false;

  favorites: boolean[] = [];
  
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
      '--clr-secondary': '#787163',
      '--clr-accent': '#b9b09f',
      '--clr-accent-light': '#b9b09f',
      '--clr-text': '#d6d3cd',
    },
    whine: {
      '--clr-background': '#1c0808',
      '--clr-primary': '#ca4c4c',
      '--clr-secondary': '#703434',
      '--clr-accent': '#b15c5c',
      '--clr-accent-light': '#b47878',
      '--clr-text': '#f1e4e4',
    },
    pink: {
      '--clr-background': '#1c081a',
      '--clr-primary': '#ca4cbb',
      '--clr-secondary': '#70346a',
      '--clr-accent': '#b478b0',
      '--clr-accent-light': '#b792b4',
      '--clr-text': '#f1e4ef',
    },
    orange: {
      '--clr-background': '#241200',       
      '--clr-primary': '#e89a36',           
      '--clr-secondary': '#a86400',         
      '--clr-accent': '#e67836',            
      '--clr-accent-light': '#e6a760',      
      '--clr-text': '#fcebd9',              
    },
    dark: {
      '--clr-background': '#0a0a0a',
      '--clr-primary': '#8a8a8a',
      '--clr-secondary': '#545454',
      '--clr-accent': '#555555',
      '--clr-accent-light': '#777777',
      '--clr-text': '#ffffff',
    },   
    
  };
  
  constructor(
    private titleService: Title,
    private metaService: Meta,
    private cdRef: ChangeDetectorRef,
    private pexelsService: PexelsService,
    private userService: UserService,
    private emojiService: EmojiService,
    private auth: AuthService,
    private router: Router,
    private firebase: FirebaseService,
    private youtubeService: YoutubeService
  ) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);

    this.firebase.obterTodosChip().subscribe((res) => {
      this.chipArray = res.map((chip) => {
        return {
          id: chip.payload.doc.id,
          ...(chip.payload.doc.data() as any),
        } as Chip;
      });
    
      this.addChipnamesToVideoIds();
    
      this.totalVideos = this.videoIds.length;
    
      const savedIndex = localStorage.getItem('currentIndex');
      const savedVideoId = localStorage.getItem('currentVideoId');
    
      if (savedVideoId && this.videoIds.includes(savedVideoId)) {
        this.currentIndex = this.videoIds.indexOf(savedVideoId);
        this.currentVideoId = savedVideoId;
      } else if (savedIndex) {
        this.currentIndex = parseInt(savedIndex, 10);
        this.currentVideoId = this.videoIds[this.currentIndex];
      } else {
        this.currentVideoId = this.videoIds[this.currentIndex];
      }
    
      this.fetchVideoOwnerInfo(this.currentVideoId);
      this.loadYouTubePlayer(); 
    });
  }

  toggleList(): void {
    this.showList = !this.showList;
  }

  addChipnamesToVideoIds(): void {
    this.videoIds = [];
    this.videoTitles = [];
  
    this.chipArray.sort((a, b) => (a.order || 0) - (b.order || 0));
  
    const chipnames = this.chipArray
      .filter(chip => chip.chipname && !this.videoIds.includes(chip.chipname))
      .map(chip => chip.chipname!);
  
    this.videoIds = [...chipnames];
  
    const titlePromises = chipnames.map(chipname =>
      this.youtubeService.getVideoTitle(chipname).toPromise()
    );
  
    Promise.all(titlePromises).then(titles => {
      this.videoTitles = titles.filter((title): title is string => title !== undefined);
      this.totalVideos = this.videoIds.length;
  
      const storedFavorites = localStorage.getItem('favorites');
      if (storedFavorites) {
        this.favorites = JSON.parse(storedFavorites);
        if (this.favorites.length !== this.videoTitles.length) {
          this.favorites = this.videoTitles.map((_, i) => this.favorites[i] || false);
        }
      } else {
        this.favorites = this.videoTitles.map(() => false);
      }
      
      const savedIndex = localStorage.getItem('currentIndex');
      const savedVideoId = localStorage.getItem('currentVideoId');
  
      if (savedVideoId && this.videoIds.includes(savedVideoId)) {
        this.currentIndex = this.videoIds.indexOf(savedVideoId);
        this.currentVideoId = savedVideoId;
      } else if (savedIndex) {
        this.currentIndex = parseInt(savedIndex, 10);
        this.currentVideoId = this.videoIds[this.currentIndex];
      } else {
        this.currentVideoId = this.videoIds[this.currentIndex];
      }

      this.initializeNewItems();
  
      this.fetchVideoOwnerInfo(this.currentVideoId);
      this.loadYouTubePlayer();
      this.cdRef.detectChanges();
    });
  }

  get hasNewItems(): boolean {
    return this.newItems.some(item => item);
  }
  
  selectVideo(index: number): void {
    console.log('Selecionado índice:', index);
    console.log('Título:', this.videoTitles[index]);
    console.log('Video ID:', this.videoIds[index]);
  
    const radioStatic = new Audio('assets/sound/static.mp3');
    radioStatic.loop = true;
    radioStatic.volume = 0.1;
    radioStatic.play().catch(err => console.error('Erro ao reproduzir som de chiado:', err));
  
    setTimeout(() => {
      radioStatic.pause();
      radioStatic.currentTime = 0;
    }, 200);
  
    this.currentIndex = index;
    this.currentVideoId = this.videoIds[this.currentIndex];
  
    localStorage.setItem('currentVideoId', this.currentVideoId);
    localStorage.setItem('currentIndex', this.currentIndex.toString());
  
    this.changeBackground();
  }
  
  ngOnInit(): void {
    const visited = localStorage.getItem('hasVisited');

    if (visited === null) {
      this.isFirstVisit = true;
      localStorage.setItem('hasVisited', 'true');
    } else {
      this.isFirstVisit = false;
    }

    const savedVolume = localStorage.getItem('volume');
    const savedIndex = localStorage.getItem('currentIndex');
    if (savedIndex) {
      this.currentIndex = parseInt(savedIndex, 10);
      this.currentVideoId = this.videoIds[this.currentIndex];
    } else {
      this.currentVideoId = this.videoIds[this.currentIndex];
    }
    if (savedVolume) {
      this.setVolume(parseInt(savedVolume, 10));
    } else {
      this.setVolume(50); 
    }
    
    this.loadRandomImage();
    this.fetchConnectedUsersCount();
    this.emoji();
    
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
    this.totalVideos = this.videoIds.length;
  }

  public markAsSeen(index: number): void {
    if (this.newItems[index]) {
      const id = this.videoIds[index];
      localStorage.setItem(`seen_${id}`, 'true');
      this.newItems[index] = false;
    }
  }

  private initializeNewItems(): void {
    this.newItems = this.videoIds.map(id => {
      const seenKey = `seen_${id}`;
      const seen = localStorage.getItem(seenKey);
  
      if (this.isFirstVisit) {
        localStorage.setItem(seenKey, 'true');
        return false;
      }
      return seen === null;
    });
  }  
  
  floatingEmojis: { emoji: string, x: number, animationDuration: number, animationDelay: number, scale: number }[] = [];
  
  emoji(): void {
    this.emojiService.getLastEmoji().subscribe((emojis: any[]) => {
      if (emojis.length > 0) {
        const emojiData = emojis[0];
        const randomX = Math.random() * 100; 
        const randomDuration = Math.random() * (5 - 2) + 2; 
        const randomDelay = Math.random() * 2; 
        const randomScale = Math.random() * (1.25 - 0.75) + 0.75;
        
        this.floatingEmojis.push({ 
          emoji: emojiData.emoji, 
          x: randomX,
          animationDuration: randomDuration,
          animationDelay: randomDelay,
          scale: randomScale
        });

        setTimeout(() => {
          this.floatingEmojis.shift();
        }, 5000);
      }
    });
  }

  addEmoji(emoji: string): void {
    this.emojiService.sendEmoji(emoji);
  }

  fetchConnectedUsersCount() {
    this.userService.getConnectedUsersCount().subscribe(count => {
      this.connectedUsersCount = count;
    });
  }
  
  triggerAnimation() {
    this.isAnimating = true;
    this.loadRandomImage();

    setTimeout(() => {
      this.isAnimating = false;
    }, 500); 
  }
  
  ngAfterViewInit() {
    
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
    const maxRetries   = 10;
    let retryCount     = 0;
    const retryInterval = 500;
  
    const initializePlayer = () => {
      // 1) Espera a API do YT estar disponível
      if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        if (retryCount++ < maxRetries) {
          setTimeout(initializePlayer, retryInterval);
        }
        return;
      }
  
      // 2) Se ainda não tiver vídeos, só retry
      if (this.videoIds.length === 0) {
        if (retryCount++ < maxRetries) {
          console.warn('Nenhum vídeo disponível… retry');
          setTimeout(initializePlayer, retryInterval);
        } else {
          console.error('Não carregou vídeos após várias tentativas.');
        }
        return;
      }
  
      // 3) Se o player não existe, cria ele e sai
      if (!this.player) {
        this.player = new YT.Player('youtube-player', {
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            modestbranding: 1,
            rel: 0,
          },
          videoId: this.currentVideoId,
          events: {
            onReady:    e => this.onPlayerReady(e),
            onStateChange: e => this.onPlayerStateChange(e),
          }
        });
        
      }
  
      // 4) Se o player já existe, tente carregar o vídeo: guard + retry
      if (typeof this.player.loadVideoById === 'function') {
        try {
          this.player.loadVideoById(this.videoIds[this.currentIndex]);
          this.updateVideoTitle();
          this.fetchVideoOwnerInfo(this.videoIds[this.currentIndex]);
        } catch (err) {
          console.error('Erro inesperado carregando vídeo:', err);
        }
      } else if (retryCount++ < maxRetries) {
        console.warn('Player ainda não pronto (sem loadVideoById). Retry…');
        setTimeout(initializePlayer, retryInterval);
      } else {
        console.error('loadVideoById não disponível após várias tentativas.');
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
  }

  onPlayerReady(event: any): void {
    this.isPlaying = false;
    this.loadYouTubePlayer();
    
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
  
      this.updateVideoTitle();
      
      if (this.isFirstLoad) {
        setTimeout(() => {
          this.player.pauseVideo(); 
          this.isFirstLoad = false; 
        }, 0);
      }
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
    this.noise();
  
    if (this.currentIndex < this.videoIds.length - 1) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0;
    }
    this.currentVideoId = this.videoIds[this.currentIndex];
    localStorage.setItem('currentVideoId', this.currentVideoId);
    localStorage.setItem('currentIndex', this.currentIndex.toString());
    this.changeBackground();
  }
  
  previousVideo(): void {
    this.noise();
  
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.videoIds.length - 1;
    }
    this.currentVideoId = this.videoIds[this.currentIndex];
    localStorage.setItem('currentVideoId', this.currentVideoId);
    localStorage.setItem('currentIndex', this.currentIndex.toString());
    this.changeBackground();
  }  
  
  shuffle(){
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * this.videoIds.length);
    } while (randomIndex === this.currentIndex && this.videoIds.length > 1);

    this.currentIndex = randomIndex;
    this.currentVideoId = this.videoIds[this.currentIndex];
    localStorage.setItem('currentVideoId', this.currentVideoId);
    localStorage.setItem('currentIndex', this.currentIndex.toString());
    this.changeBackground();
    this.noise();
  }

  noise(){
    const radioStatic = new Audio('assets/sound/static.mp3');
    radioStatic.loop = true;
    radioStatic.volume = 0.1;
    radioStatic.play().catch(err => console.error('Erro ao reproduzir som de chiado:', err));
  
    setTimeout(() => {
      radioStatic.pause();
      radioStatic.currentTime = 0;
    }, 200);
  }

  setVolume(value: number | string): void {
    const volumeValue = typeof value === 'string' ? parseInt(value, 10) : value;
    this.volume = volumeValue;
    if (this.player) {
      this.player.setVolume(volumeValue);
    }
    localStorage.setItem('volume', volumeValue.toString());
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

  getLogin(){
    return this.auth.isLoggedIn;
  }

  goAdm(){
    this.router.navigate(['/adm']);
  }

  getSliderBackground(): string {
    return `linear-gradient(to right, var(--clr-primary) 0%, var(--clr-primary) ${this.volume}%, var(--clr-secondary) ${this.volume}%, var(--clr-secondary) 100%)`;
  }

  favorite(index: number, event?: MouseEvent) {
    if (event) {
      this.addEmoji('♥');
      event.stopPropagation(); 
      event.preventDefault();
    }
    this.favorites[index] = !this.favorites[index];
    localStorage.setItem('favorites', JSON.stringify(this.favorites));
  }

  toggleFullScreen() {
    if (!this.isFullScreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
    this.isFullScreen = !this.isFullScreen;
  }

  panelOpen = false;

  togglePanel() {
    this.panelOpen = !this.panelOpen;
  }

  
}
