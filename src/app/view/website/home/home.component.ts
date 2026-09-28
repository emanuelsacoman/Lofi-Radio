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
import { FALLBACK_SITE_THEME, SiteTheme, siteThemeToCssVariables } from 'src/app/services/interfaces/site-theme';
import { Subscription } from 'rxjs';

type FloatingEmoji = {
  emoji: string;
  x: number;
  drift: number;
  duration: number;
  delay: number;
  scale: number;
  spin: number;
  glow: number;
  trailOpacity: number;
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
  
  themeOptions: SiteTheme[] = [FALLBACK_SITE_THEME];
  selectedPalette = 'purple';
  private themeSubscription?: Subscription;
  
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
    
    this.setTheme(FALLBACK_SITE_THEME.id);
    this.loadThemes();
    
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
  
  floatingEmojis: FloatingEmoji[] = [];
  
  emoji(): void {
    this.emojiService.getLastEmoji().subscribe((emojis: any[]) => {
      if (emojis.length > 0) {
        const emojiData = emojis[0];
        const drift = this.randomBetween(-18, 18);
        const spin = Math.abs(drift) < 4 ? 0 : drift * this.randomBetween(2.5, 5);
        
        const floatingEmoji: FloatingEmoji = {
          emoji: emojiData.emoji, 
          x: this.randomBetween(12, 88),
          drift,
          duration: this.randomBetween(3.8, 6.2),
          delay: this.randomBetween(0, 0.12),
          scale: this.randomBetween(0.86, 1.16),
          spin,
          glow: this.randomBetween(0.15, 0.65),
          trailOpacity: this.randomBetween(0.12, 0.36)
        };

        this.floatingEmojis.push(floatingEmoji);

        setTimeout(() => {
          this.floatingEmojis = this.floatingEmojis.filter(emoji => emoji !== floatingEmoji);
        }, (floatingEmoji.duration + floatingEmoji.delay) * 1000 + 100);
      }
    });
  }

  addEmoji(emoji: string): void {
    this.emojiService.sendEmoji(emoji);
  }

  randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
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
    this.themeSubscription?.unsubscribe();

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
    const theme = this.themeOptions.find(option => option.id === paletteKey);
    if (theme) {
      Object.entries(siteThemeToCssVariables(theme.colors)).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      this.selectedPalette = paletteKey;
      localStorage.setItem('selectedPalette', paletteKey);
    }
  }

  getThemeSwatch(theme: SiteTheme): string {
    return theme.swatch || theme.colors.primary;
  }

  private loadThemes(): void {
    this.themeSubscription = this.firebase.obterTodosTemas().subscribe({
      next: res => {
        const firestoreThemes = res
          .map(item => ({
            id: item.payload.doc.id,
            ...(item.payload.doc.data() as Omit<SiteTheme, 'id'>)
          }))
          .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
            || a.name.localeCompare(b.name));

        this.themeOptions = firestoreThemes.length ? firestoreThemes : [FALLBACK_SITE_THEME];

        const savedPalette = localStorage.getItem('selectedPalette');
        const nextPalette = savedPalette && this.themeOptions.some(theme => theme.id === savedPalette)
          ? savedPalette
          : (this.themeOptions.find(theme => theme.id === FALLBACK_SITE_THEME.id)?.id || this.themeOptions[0].id);

        this.setTheme(nextPalette);
      },
      error: () => {
        this.themeOptions = [FALLBACK_SITE_THEME];
        this.setTheme(FALLBACK_SITE_THEME.id);
      }
    });
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
