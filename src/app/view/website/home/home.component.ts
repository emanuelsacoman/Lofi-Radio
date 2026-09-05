import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { EmojiService } from 'src/app/services/emoji.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { Chip } from 'src/app/services/interfaces/chip';
import { PexelsService } from 'src/app/services/pexels.service';
import { RadioFavoritesService } from 'src/app/services/radio-favorites.service';
import { ShareService } from 'src/app/services/share.service';
import { UserService } from 'src/app/services/user.service';
import { VisitorTrackingService } from 'src/app/services/analytics/visitor-tracking.service';
import { YouTubeVideoDetails, YoutubeService } from 'src/app/services/youtube.service';
import { Subscription } from 'rxjs';

type Palette = {
  [key: string]: { [variable: string]: string };
};

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

type RadioStatus =
  | 'loading-stations'
  | 'loading-player'
  | 'ready'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'recovering'
  | 'exhausted'
  | 'empty'
  | 'error'
  | 'offline';

type RadioErrorScope = 'catalog' | 'player' | null;
type NavigationDirection = -1 | 1;

enum YouTubePlaybackState {
  Unstarted = -1,
  Ended = 0,
  Playing = 1,
  Paused = 2,
  Buffering = 3,
  Cued = 5
}

type YouTubePlayerWithMetadata = YT.Player & {
  getVideoData?: () => {
    author?: string;
    title?: string;
    video_id?: string;
  };
  getIframe?: () => HTMLIFrameElement;
};

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  title = 'Lofi Radio | Your 24/7 Soundtrack for Focus';
  description = 'Drift into handpicked lofi, chillwave and ambient stations for deep focus, quiet study and late-night unwinding.';

  randomImage: string = './assets/image/loadinglofi.gif';
  imageQuery: string = '';

  player: YouTubePlayerWithMetadata | null = null;
  isPlaying: boolean = false;
  isPlayerReady: boolean = false;
  showPlayer: boolean = true;
  playerMountContext: { attempt: number; videoId: string } | null = null;
  isOnline: boolean = typeof navigator === 'undefined' || navigator.onLine;
  radioStatus: RadioStatus = this.isOnline ? 'loading-stations' : 'offline';
  radioErrorMessage: string = '';
  desiredPlayback: boolean = false;
  recoveryDirection: NavigationDirection | null = null;

  readonly autoAdvanceDelayMs = 1100;

  readonly playerVars: YT.PlayerVars = {
    modestbranding: 1,
    playsinline: 1,
    rel: 0
  };

  connectedUsersCount: number = 0;

  public chipArray: Chip[] = [];
  videoIds: string[] = [];
  videoTitles: string[] = [];
  videoOwners: string[] = [];
  showList: boolean = false;

  @ViewChild('radioListToggle')
  private radioListToggle?: ElementRef<HTMLButtonElement>;

  @ViewChild('radioListPanel')
  private radioListPanel?: ElementRef<HTMLElement>;

  public isFirstVisit: boolean = false; 

  public newItems: boolean[] = [];

  currentIndex: number = 0;
  totalVideos: number = this.videoIds.length;
  currentVideoId: string = '';
  currentVideoTitle: string = '';
  currentVideoOwner: string = '';
  volume: number = 50;

  private readonly playerTimeoutMs = 12000;
  private readonly subscriptions = new Subscription();
  private catalogSubscription?: Subscription;
  private detailsSubscription?: Subscription;
  private catalogWatchdog?: ReturnType<typeof setTimeout>;
  private playerWatchdog?: ReturnType<typeof setTimeout>;
  private playerResetTimer?: ReturnType<typeof setTimeout>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private metadataLoadVersion = 0;
  private errorScope: RadioErrorScope = null;
  private stationChangePending = false;
  private isDestroyed = false;
  private readonly retiredPlayers = new WeakSet<YT.Player>();
  private readonly failedStationIds = new Set<string>();
  private readonly maxAutomaticRecoveryAttempts = 5;
  private readonly maxRecoveryDurationMs = 30000;
  private activeStationAttempt = 0;
  private handledFailureAttempt = -1;
  private recoveryGeneration = 0;
  private recoveryStartedAt: number | null = null;
  private lastNavigationDirection: NavigationDirection = 1;
  private refreshBackgroundOnRecoverySuccess = false;

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
      '--clr-primary': '#6f68e8',
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
    private visitorTracking: VisitorTrackingService,
    private emojiService: EmojiService,
    private auth: AuthService,
    private router: Router,
    private firebase: FirebaseService,
    private youtubeService: YoutubeService,
    private shareService: ShareService,
    private radioFavorites: RadioFavoritesService
  ) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);

    this.loadStations();
  }

  toggleList(): void {
    this.showList = !this.showList;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: Event): void {
    if (!this.showList) {
      return;
    }

    const target = event.target;
    const toggle = this.radioListToggle?.nativeElement;
    const panel = this.radioListPanel?.nativeElement;

    if (!(target instanceof Node) || !toggle || !panel) {
      return;
    }

    if (!toggle.contains(target) && !panel.contains(target)) {
      this.showList = false;
    }
  }

  shareSite(): void {
    void this.shareService.shareSite();
  }

  private loadStations(): void {
    if (!this.isOnline) {
      this.radioStatus = 'offline';
      return;
    }

    this.resetRecoverySession();
    this.clearPlayerWatchdog();
    this.radioStatus = 'loading-stations';
    this.radioErrorMessage = '';
    this.errorScope = null;
    this.catalogSubscription?.unsubscribe();
    this.startCatalogWatchdog();

    this.catalogSubscription = this.firebase.obterTodosChip().subscribe({
      next: res => {
        this.clearCatalogWatchdog();
        this.chipArray = res.map(chip => ({
          id: chip.payload.doc.id,
          ...(chip.payload.doc.data() as object)
        } as Chip));

        this.addChipnamesToVideoIds();
      },
      error: () => {
        this.clearCatalogWatchdog();
        this.setRadioError('We could not load the station list. Check your connection and try again.', 'catalog');
      }
    });
  }

  addChipnamesToVideoIds(): void {
    this.clearCatalogWatchdog();
    const previousVideoId = this.currentVideoId;
    const shouldResume = this.desiredPlayback;
    const seenVideoIds = new Set<string>();

    this.resetRecoverySession();

    this.chipArray = this.chipArray
      .filter(chip => typeof chip?.chipname === 'string' && chip.chipname.trim().length > 0)
      .sort((a, b) => {
        const aOrder = Number.isFinite(a.order) && a.order > 0
          ? a.order
          : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(b.order) && b.order > 0
          ? b.order
          : Number.MAX_SAFE_INTEGER;

        return aOrder - bOrder
          || a.chipname.trim().localeCompare(b.chipname.trim())
          || String(a.id || '').localeCompare(String(b.id || ''));
      });

    this.videoIds = this.chipArray.reduce<string[]>((ids, chip) => {
      const videoId = chip.chipname.trim();

      if (videoId && !seenVideoIds.has(videoId)) {
        seenVideoIds.add(videoId);
        ids.push(videoId);
      }

      return ids;
    }, []);

    this.totalVideos = this.videoIds.length;
    this.detailsSubscription?.unsubscribe();
    const loadVersion = ++this.metadataLoadVersion;

    if (!this.videoIds.length) {
      this.videoTitles = [];
      this.videoOwners = [];
      this.favorites = [];
      this.currentIndex = 0;
      this.currentVideoId = '';
      this.currentVideoTitle = '';
      this.currentVideoOwner = '';
      this.player = null;
      this.isPlayerReady = false;
      this.isPlaying = false;
      this.desiredPlayback = false;
      this.clearPlayerWatchdog();
      this.radioStatus = 'empty';
      return;
    }

    const nextIndex = this.resolveStoredStationIndex();
    this.videoTitles = this.videoIds.map(() => '');
    this.videoOwners = this.videoIds.map(() => '');
    this.restoreFavorites();
    this.initializeNewItems();

    if (previousVideoId !== this.videoIds[nextIndex] || !this.player) {
      this.prepareStation(nextIndex, shouldResume, false);
    } else {
      this.currentIndex = nextIndex;
      this.currentVideoId = this.videoIds[nextIndex];

      if (this.radioStatus === 'loading-stations') {
        this.radioStatus = this.isPlaying ? 'playing' : 'paused';
      }
    }

    this.detailsSubscription = this.youtubeService.getVideoDetailsBatch(this.videoIds).subscribe({
      next: details => {
        if (this.isDestroyed || loadVersion !== this.metadataLoadVersion) {
          return;
        }

        this.applyVideoDetails(details);
        this.cdRef.detectChanges();
      }
    });
  }

  get hasNewItems(): boolean {
    return this.newItems.some(item => item);
  }

  selectVideo(index: number): void {
    if (!this.isValidStationIndex(index)) {
      return;
    }

    if (index === this.currentIndex) {
      if (['error', 'ended', 'recovering', 'exhausted'].includes(this.radioStatus)) {
        this.resetRecoverySession();
        this.recreatePlayer(this.desiredPlayback);
      }
      return;
    }

    this.resetRecoverySession();
    this.lastNavigationDirection = 1;
    this.noise();
    this.prepareStation(index, this.desiredPlayback, true);
  }
  
  ngOnInit(): void {
    this.visitorTracking.start();

    const visited = localStorage.getItem('hasVisited');

    if (visited === null) {
      this.isFirstVisit = true;
      localStorage.setItem('hasVisited', 'true');
    } else {
      this.isFirstVisit = false;
    }

    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      this.setVolume(parseInt(savedVolume, 10));
    } else {
      this.setVolume(50); 
    }
    
    this.loadRandomImage(this.imageQuery);
    this.fetchConnectedUsersCount();
    this.emoji();
    
    const savedPalette = localStorage.getItem('selectedPalette') || 'purple';
    this.setTheme(savedPalette);
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
    this.subscriptions.add(this.emojiService.getLastEmoji().subscribe((emojis: any[]) => {
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
    }));
  }

  addEmoji(emoji: string): void {
    this.emojiService.sendEmoji(emoji);
  }

  randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  fetchConnectedUsersCount() {
    this.subscriptions.add(this.userService.getConnectedUsersCount().subscribe(count => {
      this.connectedUsersCount = count;
    }));
  }
  
  triggerAnimation() {
    this.isAnimating = true;
    this.loadRandomImage(this.imageQuery);

    setTimeout(() => {
      this.isAnimating = false;
    }, 500); 
  }
  
  ngAfterViewInit() {
    
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.visitorTracking.stop();
    this.catalogSubscription?.unsubscribe();
    this.detailsSubscription?.unsubscribe();
    this.subscriptions.unsubscribe();
    this.clearCatalogWatchdog();
    this.clearPlayerWatchdog();
    this.clearRecoveryTimer();

    if (this.playerResetTimer) {
      clearTimeout(this.playerResetTimer);
    }

    this.player = null;
    this.playerMountContext = null;
  }

  setDocTitle(title: string) {
    this.titleService.setTitle(title);
  }

  setMetaDescription(description: string) {
    this.metaService.updateTag({ name: 'description', content: description });
  }

  async loadRandomImage(query?: string) {
    const image = await this.pexelsService.fetchRandomImage(query);
    if (image) {
      this.randomImage = image;
    }
  }

  applyImageQuery(): void {
    void this.loadRandomImage(this.imageQuery);
    this.triggerAnimation();
  }

  changeBackground() {
    void this.loadRandomImage(this.imageQuery);
  }

  private resolveStoredStationIndex(): number {
    const savedVideoId = localStorage.getItem('currentVideoId');
    const preferredVideoId = savedVideoId && this.videoIds.includes(savedVideoId)
      ? savedVideoId
      : this.currentVideoId;

    if (preferredVideoId && this.videoIds.includes(preferredVideoId)) {
      return this.videoIds.indexOf(preferredVideoId);
    }

    const savedIndex = Number.parseInt(localStorage.getItem('currentIndex') || '', 10);
    return Number.isInteger(savedIndex) && this.isValidStationIndex(savedIndex) ? savedIndex : 0;
  }

  private restoreFavorites(): void {
    this.radioFavorites.load(this.videoIds);
    this.syncFavoriteView();
  }

  private applyVideoDetails(details: YouTubeVideoDetails[]): void {
    this.videoTitles = this.videoIds.map((_, index) => {
      const title = details[index]?.title;
      return !title || title === 'Temporarily unavailable' ? `Lofi station ${index + 1}` : title;
    });
    this.videoOwners = this.videoIds.map((_, index) => {
      const creator = details[index]?.creator;
      return !creator || creator === 'Unknown' ? '' : creator;
    });
    this.applyCurrentMetadata();
  }

  private applyCurrentMetadata(): void {
    if (!this.isValidStationIndex(this.currentIndex)) {
      this.currentVideoTitle = '';
      this.currentVideoOwner = '';
      return;
    }

    this.currentVideoTitle = this.videoTitles[this.currentIndex] || '';
    this.currentVideoOwner = this.videoOwners[this.currentIndex] || '';
  }

  private updateMetadataFromPlayer(): void {
    const videoData = this.player?.getVideoData?.();

    if (!videoData || (videoData.video_id && videoData.video_id !== this.currentVideoId)) {
      return;
    }

    if (videoData.title) {
      this.currentVideoTitle = videoData.title;
      this.videoTitles[this.currentIndex] = videoData.title;
    }

    if (videoData.author) {
      this.currentVideoOwner = videoData.author;
      this.videoOwners[this.currentIndex] = videoData.author;
    }
  }

  private prepareStation(index: number, shouldResume: boolean, refreshBackground: boolean): void {
    if (!this.isValidStationIndex(index)) {
      return;
    }

    this.clearPlayerWatchdog();
    this.clearRecoveryTimer();
    const attempt = ++this.activeStationAttempt;
    this.handledFailureAttempt = -1;
    this.currentIndex = index;
    this.currentVideoId = this.videoIds[index];
    this.applyCurrentMetadata();
    this.isPlaying = false;
    this.isPlayerReady = false;
    this.desiredPlayback = shouldResume;
    this.stationChangePending = true;
    this.radioErrorMessage = '';
    this.errorScope = null;
    this.recoveryDirection = null;

    if (refreshBackground) {
      this.refreshBackgroundOnRecoverySuccess = false;
      this.changeBackground();
    }

    if (this.isOnline) {
      this.radioStatus = 'loading-player';
      this.mountFreshPlayer(attempt);
    } else {
      this.radioStatus = 'offline';
    }
  }

  onPlayerReady(event: YT.PlayerEvent, attempt: number = this.activeStationAttempt): void {
    if (attempt !== this.activeStationAttempt || !this.isCurrentPlayerEvent(event.target)) {
      return;
    }

    this.player = event.target;
    this.isPlayerReady = true;
    this.isPlaying = false;
    this.radioErrorMessage = '';
    this.errorScope = null;

    try {
      this.player.setVolume(this.volume);
      const playerIframe = this.player.getIframe?.();
      playerIframe?.setAttribute('aria-hidden', 'true');

      if (playerIframe) {
        playerIframe.tabIndex = -1;
      }
    } catch {
      this.setRadioError('The audio player could not be configured. Please try again.', 'player');
      return;
    }

    this.stationChangePending = false;
    this.clearPlayerWatchdog();

    if (!this.isOnline) {
      this.radioStatus = 'offline';
      return;
    }

    this.radioStatus = 'ready';

    if (this.desiredPlayback) {
      this.startPlayback();
    } else {
      this.confirmStationSuccess();
    }
  }

  onPlayerStateChange(event: YT.OnStateChangeEvent, attempt: number = this.activeStationAttempt): void {
    if (attempt !== this.activeStationAttempt) {
      return;
    }

    if (!this.isOnline) {
      this.radioStatus = 'offline';
      return;
    }

    if (!this.isCurrentPlayerEvent(event.target)) {
      return;
    }

    switch (event.data as number) {
      case YouTubePlaybackState.Playing:
        this.stationChangePending = false;
        this.desiredPlayback = true;
        this.isPlaying = true;
        this.radioStatus = 'playing';
        this.updateMetadataFromPlayer();
        this.clearPlayerWatchdog();
        this.confirmStationSuccess();
        break;
      case YouTubePlaybackState.Paused:
        if (!this.stationChangePending) {
          this.isPlaying = false;
          this.radioStatus = 'paused';
          this.clearPlayerWatchdog();
        }
        break;
      case YouTubePlaybackState.Buffering:
        this.stationChangePending = false;
        this.isPlaying = false;
        this.radioStatus = 'buffering';
        this.startPlayerWatchdog();
        break;
      case YouTubePlaybackState.Cued:
        this.stationChangePending = false;
        this.isPlaying = false;
        this.radioStatus = 'ready';
        this.updateMetadataFromPlayer();
        this.clearPlayerWatchdog();

        if (this.desiredPlayback) {
          this.startPlayback();
        } else {
          this.confirmStationSuccess();
        }
        break;
      case YouTubePlaybackState.Ended:
        if (!this.stationChangePending) {
          this.isPlaying = false;
          this.radioStatus = 'ended';
          this.clearPlayerWatchdog();
          this.handleStationFailure('The broadcast ended.');
        }
        break;
      case YouTubePlaybackState.Unstarted:
        if (this.stationChangePending) {
          this.radioStatus = 'loading-player';
          this.startPlayerWatchdog();
        }
        break;
    }
  }

  onPlayerError(event: YT.OnErrorEvent, attempt: number = this.activeStationAttempt): void {
    if (attempt !== this.activeStationAttempt || !this.isCurrentPlayerEvent(event.target)) {
      return;
    }

    this.stationChangePending = false;
    this.isPlaying = false;
    this.handleStationFailure(this.getPlayerErrorMessage(event.data));
  }

  togglePlayPause(): void {
    if (this.radioStatus === 'error' && this.errorScope === 'catalog') {
      this.retryRadio();
      return;
    }

    if (this.radioStatus === 'exhausted' && this.currentVideoId) {
      this.desiredPlayback = true;
      this.resetRecoverySession();
      this.recreatePlayer(true);
      return;
    }

    if (!this.canControlPlayback || !this.player) {
      return;
    }

    try {
      if (this.isPlaying) {
        this.desiredPlayback = false;
        this.player.pauseVideo();
        this.isPlaying = false;
        this.radioStatus = 'paused';
        this.clearPlayerWatchdog();
      } else {
        this.desiredPlayback = true;
        this.startPlayback();
      }
    } catch {
      this.handleStationFailure('The radio did not respond.');
    }
  }

  retryRadio(resumePlayback: boolean = this.desiredPlayback): void {
    if (!this.isOnline) {
      this.radioStatus = 'offline';
      return;
    }

    if (this.errorScope === 'catalog' || !this.videoIds.length) {
      this.loadStations();
      return;
    }

    this.resetRecoverySession();
    this.recreatePlayer(resumePlayback);
  }

  @HostListener('window:offline')
  handleOffline(): void {
    this.isOnline = false;
    this.isPlaying = false;
    this.clearCatalogWatchdog();
    this.clearPlayerWatchdog();
    this.clearRecoveryTimer();
    this.recoveryDirection = null;
    this.recoveryGeneration++;

    try {
      this.player?.pauseVideo();
    } catch {
      // The status below is enough feedback if the player is already unreachable.
    }

    this.radioStatus = 'offline';
  }

  @HostListener('window:online')
  handleOnline(): void {
    this.isOnline = true;

    if (!this.videoIds.length || this.errorScope === 'catalog') {
      this.loadStations();
      return;
    }

    this.resetRecoverySession();
    this.recreatePlayer(this.desiredPlayback);
  }

  get radioStatusMessage(): string {
    switch (this.radioStatus) {
      case 'loading-stations':
        return 'Loading stations';
      case 'loading-player':
        return 'Connecting to the station';
      case 'buffering':
        return 'Buffering audio';
      case 'ready':
        return 'Station ready';
      case 'playing':
        return 'Playing';
      case 'paused':
        return 'Paused';
      case 'ended':
        return 'Station ended';
      case 'recovering':
        return this.recoveryDirection === -1
          ? 'Station unavailable. Returning to the previous station.'
          : 'Station unavailable. Moving to the next station.';
      case 'exhausted':
        return 'No playable station was found';
      case 'empty':
        return 'No stations available';
      case 'offline':
        return 'Offline';
      case 'error':
        return this.radioErrorMessage || 'Radio unavailable';
    }
  }

  get radioStatusIcon(): string {
    switch (this.radioStatus) {
      case 'playing':
        return 'graphic_eq';
      case 'paused':
        return 'pause_circle';
      case 'ready':
        return 'check_circle';
      case 'ended':
        return 'stop_circle';
      case 'recovering':
        return this.recoveryDirection === -1 ? 'skip_previous' : 'skip_next';
      case 'exhausted':
        return 'play_disabled';
      case 'empty':
        return 'radio';
      case 'offline':
        return 'wifi_off';
      case 'error':
        return 'error_outline';
      default:
        return 'radio';
    }
  }

  get isRadioBusy(): boolean {
    return ['loading-stations', 'loading-player', 'buffering'].includes(this.radioStatus);
  }

  get showPlaySpinner(): boolean {
    return this.isRadioBusy;
  }

  get playerControlIcon(): string {
    if (this.isPlaying) {
      return 'pause';
    }

    switch (this.radioStatus) {
      case 'offline':
        return 'wifi_off';
      case 'empty':
        return 'radio';
      case 'error':
        return 'sync_problem';
      case 'recovering':
      case 'exhausted':
        return 'play_disabled';
      default:
        return 'play_arrow';
    }
  }

  get hasRadioError(): boolean {
    return this.radioStatus === 'error' || this.radioStatus === 'exhausted';
  }

  get canRetryRadio(): boolean {
    return this.isOnline && ['error', 'ended', 'exhausted'].includes(this.radioStatus);
  }

  get showNextRecoveryAction(): boolean {
    return this.recoveryDirection === 1;
  }

  get canControlPlayback(): boolean {
    return this.isOnline
      && this.isPlayerReady
      && ['ready', 'paused', 'playing'].includes(this.radioStatus);
  }

  get isPlayerControlDisabled(): boolean {
    return this.showPlaySpinner
      || ['recovering', 'offline', 'empty'].includes(this.radioStatus);
  }

  get canNavigateStations(): boolean {
    return this.isOnline
      && this.videoIds.length > 1
      && !['loading-stations', 'offline', 'empty'].includes(this.radioStatus);
  }

  get canFavoriteCurrentStation(): boolean {
    return this.isValidStationIndex(this.currentIndex);
  }

  get playPauseLabel(): string {
    if (this.showPlaySpinner) {
      return 'Loading station';
    }

    switch (this.radioStatus) {
      case 'recovering':
        return 'Skipping unavailable station';
      case 'exhausted':
        return 'Retry station';
      case 'offline':
        return 'Radio offline';
      case 'empty':
        return 'No stations available';
      case 'error':
        return 'Reload stations';
      default:
        return this.isPlaying ? 'Pause radio' : 'Play radio';
    }
  }

  private startPlayback(): void {
    if (!this.player || !this.isPlayerReady || !this.isOnline) {
      return;
    }

    try {
      this.desiredPlayback = true;
      this.radioStatus = 'buffering';
      this.player.playVideo();
      this.startPlayerWatchdog();
    } catch {
      this.handleStationFailure('The radio did not respond.');
    }
  }

  private recreatePlayer(resumePlayback: boolean): void {
    if (!this.currentVideoId) {
      this.loadStations();
      return;
    }

    const currentIndex = this.videoIds.indexOf(this.currentVideoId);
    this.prepareStation(currentIndex >= 0 ? currentIndex : this.currentIndex, resumePlayback, false);
  }

  private mountFreshPlayer(attempt: number): void {
    if (this.playerResetTimer) {
      clearTimeout(this.playerResetTimer);
      this.playerResetTimer = undefined;
    }

    if (this.player) {
      this.retiredPlayers.add(this.player);
    }

    this.player = null;
    this.isPlayerReady = false;
    this.showPlayer = false;
    this.playerMountContext = null;

    this.playerResetTimer = setTimeout(() => {
      this.playerResetTimer = undefined;

      if (this.isDestroyed || !this.isOnline || attempt !== this.activeStationAttempt) {
        return;
      }

      this.playerMountContext = { attempt, videoId: this.currentVideoId };
      this.showPlayer = true;
      this.cdRef.detectChanges();
      this.reloadYouTubeApiIfUnavailable();
      this.startPlayerWatchdog(attempt);
    }, 0);
  }

  private reloadYouTubeApiIfUnavailable(): void {
    if (typeof YT !== 'undefined' && typeof YT.Player !== 'undefined') {
      return;
    }

    document.querySelector<HTMLScriptElement>('script[src*="youtube.com/iframe_api"]')?.remove();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  }

  private startPlayerWatchdog(attempt: number = this.activeStationAttempt): void {
    this.clearPlayerWatchdog();

    if (!this.isOnline || this.isDestroyed) {
      return;
    }

    const videoId = this.currentVideoId;
    this.playerWatchdog = setTimeout(() => {
      if (
        attempt === this.activeStationAttempt
        && videoId === this.currentVideoId
        && (this.radioStatus === 'loading-player' || this.radioStatus === 'buffering')
      ) {
        const message = this.radioStatus === 'buffering'
          ? 'The audio took too long to start.'
          : 'The station took too long to respond.';
        this.handleStationFailure(message);
      }
    }, this.playerTimeoutMs);
  }

  private startCatalogWatchdog(): void {
    this.clearCatalogWatchdog();

    if (!this.isOnline || this.isDestroyed) {
      return;
    }

    this.catalogWatchdog = setTimeout(() => {
      if (this.radioStatus === 'loading-stations') {
        this.setRadioError('The station list is taking too long to load. Please try again.', 'catalog');
      }
    }, this.playerTimeoutMs);
  }

  private clearCatalogWatchdog(): void {
    if (this.catalogWatchdog) {
      clearTimeout(this.catalogWatchdog);
      this.catalogWatchdog = undefined;
    }
  }

  private clearPlayerWatchdog(): void {
    if (this.playerWatchdog) {
      clearTimeout(this.playerWatchdog);
      this.playerWatchdog = undefined;
    }
  }

  private setRadioError(message: string, scope: Exclude<RadioErrorScope, null>): void {
    if (scope === 'player') {
      this.handleStationFailure(message);
      return;
    }

    this.clearCatalogWatchdog();
    this.clearPlayerWatchdog();
    this.resetRecoverySession();
    this.isPlaying = false;
    this.stationChangePending = false;
    this.radioErrorMessage = message;
    this.errorScope = scope;
    this.radioStatus = this.isOnline ? 'error' : 'offline';
  }

  private handleStationFailure(message: string): void {
    if (!this.isOnline) {
      this.radioStatus = 'offline';
      return;
    }

    if (!this.currentVideoId || this.handledFailureAttempt === this.activeStationAttempt) {
      return;
    }

    this.handledFailureAttempt = this.activeStationAttempt;
    this.clearPlayerWatchdog();
    this.clearRecoveryTimer();
    this.isPlaying = false;
    this.isPlayerReady = false;
    this.stationChangePending = false;
    this.radioErrorMessage = message;
    this.errorScope = 'player';

    if (this.player) {
      const failedPlayer = this.player;
      this.retiredPlayers.add(failedPlayer);

      try {
        failedPlayer.pauseVideo();
      } catch {
        // A failed player may already be detached. Retiring it is sufficient.
      }

      this.player = null;
    }

    if (this.recoveryStartedAt === null) {
      this.recoveryStartedAt = Date.now();
    }

    this.failedStationIds.add(this.currentVideoId);
    const maxFailures = Math.min(this.videoIds.length, this.maxAutomaticRecoveryAttempts);
    const recoveryExpired = Date.now() - this.recoveryStartedAt >= this.maxRecoveryDurationMs;
    const nextIndex = this.findRecoveryCandidate(this.lastNavigationDirection);

    if (
      this.videoIds.length < 2
      || this.failedStationIds.size >= maxFailures
      || recoveryExpired
      || nextIndex === null
    ) {
      this.finishExhaustedRecovery();
      return;
    }

    this.radioStatus = 'recovering';
    this.recoveryDirection = this.lastNavigationDirection;
    const attempt = this.activeStationAttempt;
    const videoId = this.currentVideoId;
    const direction = this.lastNavigationDirection;
    const generation = ++this.recoveryGeneration;

    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = undefined;

      if (
        this.isDestroyed
        || !this.isOnline
        || this.radioStatus !== 'recovering'
        || generation !== this.recoveryGeneration
        || attempt !== this.activeStationAttempt
        || videoId !== this.currentVideoId
        || direction !== this.recoveryDirection
      ) {
        return;
      }

      const candidateIndex = this.findRecoveryCandidate(direction);
      const timedOut = this.recoveryStartedAt !== null
        && Date.now() - this.recoveryStartedAt >= this.maxRecoveryDurationMs;

      if (candidateIndex === null || timedOut) {
        this.finishExhaustedRecovery();
        return;
      }

      this.recoveryDirection = null;
      this.refreshBackgroundOnRecoverySuccess = true;
      this.prepareStation(candidateIndex, this.desiredPlayback, false);
    }, this.recoveryAnimationDelayMs);
  }

  private findRecoveryCandidate(direction: NavigationDirection): number | null {
    const stationCount = this.videoIds.length;

    for (let offset = 1; offset < stationCount; offset++) {
      const index = (this.currentIndex + direction * offset + stationCount) % stationCount;

      if (!this.failedStationIds.has(this.videoIds[index])) {
        return index;
      }
    }

    return null;
  }

  private finishExhaustedRecovery(): void {
    this.clearRecoveryTimer();
    this.recoveryGeneration++;
    this.recoveryDirection = null;
    this.radioStatus = this.isOnline ? 'exhausted' : 'offline';
  }

  private resetRecoverySession(): void {
    this.clearRecoveryTimer();
    this.recoveryGeneration++;
    this.recoveryDirection = null;
    this.failedStationIds.clear();
    this.recoveryStartedAt = null;
    this.handledFailureAttempt = -1;
  }

  private completeRecoverySession(): void {
    this.resetRecoverySession();
  }

  private confirmStationSuccess(): void {
    const shouldRefreshBackground = this.refreshBackgroundOnRecoverySuccess;
    this.refreshBackgroundOnRecoverySuccess = false;
    this.completeRecoverySession();
    this.persistCurrentStation();

    if (shouldRefreshBackground) {
      this.changeBackground();
    }
  }

  private persistCurrentStation(): void {
    localStorage.setItem('currentVideoId', this.currentVideoId);
    localStorage.setItem('currentIndex', this.currentIndex.toString());
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  private get recoveryAnimationDelayMs(): number {
    const reduceMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduceMotion ? 250 : this.autoAdvanceDelayMs;
  }

  private getPlayerErrorMessage(errorCode: number): string {
    switch (errorCode) {
      case 2:
        return 'This station has an invalid address.';
      case 5:
        return 'This station cannot play in your browser right now.';
      case 100:
        return 'This station is no longer available.';
      case 101:
      case 150:
        return 'This station does not allow playback here.';
      default:
        return 'We could not start this station. Please try again.';
    }
  }

  private isValidStationIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.videoIds.length;
  }

  private isCurrentPlayerEvent(player?: YT.Player): boolean {
    if (!player) {
      return true;
    }

    if (this.retiredPlayers.has(player) || (this.player && player !== this.player)) {
      return false;
    }

    const eventPlayer = player as YouTubePlayerWithMetadata;

    try {
      const eventVideoId = eventPlayer.getVideoData?.().video_id;
      return !eventVideoId || eventVideoId === this.currentVideoId;
    } catch {
      return false;
    }
  }

  nextVideo(): void {
    this.navigateManually(1);
  }
  
  previousVideo(): void {
    this.navigateManually(-1);
  }  
  
  shuffle(): void {
    if (this.videoIds.length < 2 || !this.isOnline) {
      return;
    }

    this.resetRecoverySession();
    this.lastNavigationDirection = 1;
    const candidates = this.videoIds
      .map((_, index) => index)
      .filter(index => index !== this.currentIndex);
    const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
    this.noise();
    this.prepareStation(randomIndex, this.desiredPlayback, true);
  }

  private navigateManually(direction: NavigationDirection): void {
    if (this.videoIds.length < 2 || !this.isOnline) {
      return;
    }

    this.resetRecoverySession();
    this.lastNavigationDirection = direction;
    const nextIndex = (
      this.currentIndex + direction + this.videoIds.length
    ) % this.videoIds.length;
    this.noise();
    this.prepareStation(nextIndex, this.desiredPlayback, true);
  }

  noise(): void {
    if (typeof Audio === 'undefined') {
      return;
    }

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
    const parsedValue = typeof value === 'string' ? Number.parseInt(value, 10) : value;
    const volumeValue = Number.isFinite(parsedValue) ? Math.min(100, Math.max(0, parsedValue)) : 50;
    this.volume = volumeValue;
    if (this.player) {
      try {
        this.player.setVolume(volumeValue);
      } catch {
        // The selected volume is retained and applied when the player is ready.
      }
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
    if (!this.isValidStationIndex(index)) {
      return;
    }

    if (event) {
      this.addEmoji('♥');
      event.stopPropagation(); 
      event.preventDefault();
    }
    this.radioFavorites.toggle(this.videoIds[index]);
    this.syncFavoriteView();
  }

  private syncFavoriteView(): void {
    this.favorites = this.videoIds.map(videoId => this.radioFavorites.isFavorite(videoId));
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
