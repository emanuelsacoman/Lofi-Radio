import { NEVER, Subject, of } from 'rxjs';

import { Chip } from 'src/app/services/interfaces/chip';
import { HomeComponent } from './home.component';

describe('HomeComponent non-verbal radio feedback', () => {
  const playerTimeoutMs = 12_000;

  let component: HomeComponent;
  let changeDetector: jasmine.SpyObj<{ detectChanges: () => void }>;
  let firebase: jasmine.SpyObj<{ obterTodosChip: () => unknown }>;
  let youtube: jasmine.SpyObj<{ getVideoDetailsBatch: (videoIds: string[]) => unknown }>;

  beforeEach(() => {
    jasmine.clock().install();
    localStorage.clear();

    const title = jasmine.createSpyObj('Title', ['setTitle']);
    const meta = jasmine.createSpyObj('Meta', ['updateTag']);
    changeDetector = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);
    const pexels = jasmine.createSpyObj('PexelsService', ['fetchRandomImage']);
    const users = jasmine.createSpyObj('UserService', ['getConnectedUsersCount']);
    const emojis = jasmine.createSpyObj('EmojiService', ['getLastEmoji', 'sendEmoji']);
    const router = jasmine.createSpyObj('Router', ['navigate']);
    firebase = jasmine.createSpyObj('FirebaseService', ['obterTodosChip']);
    youtube = jasmine.createSpyObj('YoutubeService', ['getVideoDetailsBatch']);
    const share = jasmine.createSpyObj('ShareService', ['shareSite']);

    firebase.obterTodosChip.and.returnValue(NEVER);
    youtube.getVideoDetailsBatch.and.returnValue(of([]));

    component = new HomeComponent(
      title,
      meta,
      changeDetector as any,
      pexels,
      users,
      emojis,
      { isLoggedIn: false } as any,
      router,
      firebase as any,
      youtube as any,
      share
    );

    component.isOnline = true;
  });

  afterEach(() => {
    component.ngOnDestroy();
    localStorage.clear();
    jasmine.clock().uninstall();
  });

  it('uses the play control itself as non-verbal loading feedback', () => {
    expect(component.radioStatus).toBe('loading-stations');
    expect(component.showPlaySpinner).toBeTrue();
    expect(component.playerControlIcon).toBe('play_arrow');
    expect(component.isPlayerControlDisabled).toBeTrue();

    component.radioStatus = 'loading-player';
    expect(component.showPlaySpinner).toBeTrue();

    component.radioStatus = 'buffering';
    expect(component.showPlaySpinner).toBeTrue();

    component.radioStatus = 'ready';
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.playerControlIcon).toBe('play_arrow');
    expect(component.isPlayerControlDisabled).toBeFalse();

    component.isPlaying = true;
    component.radioStatus = 'playing';
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.playerControlIcon).toBe('pause');
    expect(component.isPlayerControlDisabled).toBeFalse();
  });

  it('loads an empty catalog without enabling unavailable controls', () => {
    const stations$ = new Subject<any[]>();
    firebase.obterTodosChip.and.returnValue(stations$);
    firebase.obterTodosChip.calls.reset();

    component.retryRadio();

    expect(firebase.obterTodosChip).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('loading-stations');
    expect(component.showPlaySpinner).toBeTrue();
    expect(component.canControlPlayback).toBeFalse();

    stations$.next([]);

    expect(component.radioStatus).toBe('empty');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.canNavigateStations).toBeFalse();
    expect(component.recoveryDirection).toBeNull();
  });

  it('uses player loading feedback while station metadata resolves', () => {
    component.chipArray = [new Chip('station-document', 'station-video', 1)];
    youtube.getVideoDetailsBatch.and.returnValue(of([
      { title: 'Late Night Lofi', creator: 'Test Radio' }
    ]));

    component.addChipnamesToVideoIds();

    expect(youtube.getVideoDetailsBatch).toHaveBeenCalledOnceWith(['station-video']);
    expect(component.currentVideoId).toBe('station-video');
    expect(component.currentVideoTitle).toBe('Late Night Lofi');
    expect(component.currentVideoOwner).toBe('Test Radio');
    expect(component.radioStatus).toBe('loading-player');
    expect(component.showPlaySpinner).toBeTrue();
    expect(component.canControlPlayback).toBeFalse();
  });

  it('keeps catalog failures separate from automatic station recovery', () => {
    const failedRequest$ = new Subject<any[]>();
    firebase.obterTodosChip.and.returnValue(failedRequest$);
    firebase.obterTodosChip.calls.reset();
    component.retryRadio();

    failedRequest$.error(new Error('catalog unavailable'));

    expect(component.radioStatus).toBe('error');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.recoveryDirection).toBeNull();

    const retryRequest$ = new Subject<any[]>();
    firebase.obterTodosChip.and.returnValue(retryRequest$);
    component.retryRadio();

    expect(firebase.obterTodosChip).toHaveBeenCalledTimes(2);
    expect(component.radioStatus).toBe('loading-stations');
    expect(component.showPlaySpinner).toBeTrue();
  });

  it('returns the play control to normal after ready, playing and paused events', () => {
    const player = configureStations(['station-video', 'backup-video'], 0, 'ready');

    component.onPlayerReady({ target: player } as unknown as YT.PlayerEvent);

    expect(player.setVolume).toHaveBeenCalledOnceWith(50);
    expect(component.radioStatus).toBe('ready');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.playerControlIcon).toBe('play_arrow');

    component.togglePlayPause();

    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
    expect(component.showPlaySpinner).toBeTrue();

    emitState(player, 1);

    expect(component.radioStatus).toBe('playing');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.playerControlIcon).toBe('pause');

    component.togglePlayPause();

    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('paused');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.playerControlIcon).toBe('play_arrow');
  });

  it('animates forward recovery before advancing after a player error', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    component.nextVideo();
    emitError(createPlayer(component.currentVideoId));

    expect(component.autoAdvanceDelayMs).toBe(1_100);
    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('recovering');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.recoveryDirection).toBe(1);
    expect(component.isPlayerControlDisabled).toBeTrue();

    jasmine.clock().tick(component.autoAdvanceDelayMs - 1);

    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('recovering');

    jasmine.clock().tick(1);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
    expect(component.radioStatus).toBe('loading-player');
    expect(component.showPlaySpinner).toBeTrue();
  });

  it('preserves backward recovery, including wraparound', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 1, 'playing');

    component.previousVideo();
    emitError(createPlayer(component.currentVideoId));

    expect(component.currentIndex).toBe(0);
    expect(component.radioStatus).toBe('recovering');
    expect(component.recoveryDirection).toBe(-1);

    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
    expect(component.radioStatus).toBe('loading-player');
  });

  it('falls forward after direct list selection instead of inheriting an old direction', () => {
    configureStations(['station-a', 'station-b', 'station-c', 'station-d'], 2, 'playing');

    component.previousVideo();
    component.selectVideo(3);
    emitError(createPlayer(component.currentVideoId));

    expect(component.currentIndex).toBe(3);
    expect(component.recoveryDirection).toBe(1);

    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(0);
  });

  it('falls forward after shuffle instead of inheriting an old direction', () => {
    configureStations(['station-a', 'station-b', 'station-c', 'station-d'], 2, 'playing');
    spyOn(Math, 'random').and.returnValue(0.9);

    component.previousVideo();
    component.shuffle();
    emitError(createPlayer(component.currentVideoId));

    expect(component.currentIndex).toBe(3);
    expect(component.recoveryDirection).toBe(1);

    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(0);
  });

  it('uses the same delayed recovery when the current broadcast ends', () => {
    const player = configureStations(['station-a', 'station-b'], 0, 'playing');

    emitState(player, 0);

    expect(component.currentIndex).toBe(0);
    expect(component.radioStatus).toBe('recovering');
    expect(component.recoveryDirection).toBe(1);

    jasmine.clock().tick(component.autoAdvanceDelayMs - 1);
    expect(component.currentIndex).toBe(0);

    jasmine.clock().tick(1);
    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('loading-player');
  });

  it('turns a stalled buffer into delayed automatic recovery', () => {
    const player = configureStations(['station-a', 'station-b'], 0, 'ready');

    component.togglePlayPause();
    jasmine.clock().tick(playerTimeoutMs - 1);

    expect(component.radioStatus).toBe('buffering');
    expect(component.showPlaySpinner).toBeTrue();
    expect(component.currentIndex).toBe(0);

    jasmine.clock().tick(1);

    expect(component.radioStatus).toBe('recovering');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.recoveryDirection).toBe(1);
    expect(component.currentIndex).toBe(0);

    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('loading-player');
  });

  it('does not auto-advance a stalled catalog', () => {
    jasmine.clock().tick(playerTimeoutMs);

    expect(component.radioStatus).toBe('error');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.recoveryDirection).toBeNull();

    jasmine.clock().tick(component.autoAdvanceDelayMs * 2);

    expect(component.currentVideoId).toBe('');
  });

  it('preserves autoplay intent through a chain of failed stations', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    component.nextVideo();
    expect(component.desiredPlayback).toBeTrue();
    emitError(createPlayer(component.currentVideoId));
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.desiredPlayback).toBeTrue();

    const recoveredPlayer = createPlayer('station-c');
    component.onPlayerReady({ target: recoveredPlayer } as unknown as YT.PlayerEvent);

    expect(component.currentVideoId).toBe('station-c');
    expect(recoveredPlayer.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
    expect(component.showPlaySpinner).toBeTrue();
  });

  it('does not force autoplay when recovery began while paused', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'paused');

    component.nextVideo();
    expect(component.desiredPlayback).toBeFalse();
    emitError(createPlayer(component.currentVideoId));
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.desiredPlayback).toBeFalse();

    const recoveredPlayer = createPlayer('station-c');
    component.onPlayerReady({ target: recoveredPlayer } as unknown as YT.PlayerEvent);

    expect(component.currentVideoId).toBe('station-c');
    expect(recoveredPlayer.playVideo).not.toHaveBeenCalled();
    expect(component.radioStatus).toBe('ready');
    expect(component.showPlaySpinner).toBeFalse();
  });

  it('does not restart a recovery countdown for duplicate player errors', () => {
    const player = configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError(player);
    jasmine.clock().tick(600);
    emitError(player);
    jasmine.clock().tick(component.autoAdvanceDelayMs - 601);

    expect(component.currentIndex).toBe(0);

    jasmine.clock().tick(1);

    expect(component.currentIndex).toBe(1);

    jasmine.clock().tick(600);
    expect(component.currentIndex).toBe(1);
  });

  it('cancels pending automatic recovery when the user navigates manually', () => {
    const player = configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    emitError(player);
    jasmine.clock().tick(500);

    component.previousVideo();

    expect(component.currentIndex).toBe(2);
    expect(component.radioStatus).toBe('loading-player');

    jasmine.clock().tick(component.autoAdvanceDelayMs - 499);

    expect(component.currentIndex).toBe(2);
    expect(component.radioStatus).toBe('loading-player');
  });

  it('cancels pending recovery when the user selects a station from the list', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    emitError();
    jasmine.clock().tick(500);
    component.selectVideo(2);

    jasmine.clock().tick(component.autoAdvanceDelayMs - 499);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
    expect(component.radioStatus).toBe('loading-player');
  });

  it('cancels pending recovery when the user shuffles', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');
    spyOn(Math, 'random').and.returnValue(0.8);

    emitError();
    jasmine.clock().tick(500);
    component.shuffle();

    jasmine.clock().tick(component.autoAdvanceDelayMs - 499);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
    expect(component.radioStatus).toBe('loading-player');
  });

  it('cancels pending recovery when the browser goes offline', () => {
    configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError();
    jasmine.clock().tick(500);
    component.handleOffline();
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(0);
    expect(component.radioStatus).toBe('offline');
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.recoveryDirection).toBeNull();
  });

  it('cancels pending recovery when the component is destroyed', () => {
    configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError();
    jasmine.clock().tick(500);
    component.ngOnDestroy();
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(0);
  });

  it('does not let a late playing event from the failed player cancel recovery', () => {
    const player = configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError(player);
    jasmine.clock().tick(500);
    emitState(player, 1);

    expect(component.currentIndex).toBe(0);
    expect(component.radioStatus).toBe('recovering');

    jasmine.clock().tick(component.autoAdvanceDelayMs - 500);

    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('loading-player');
    expect(component.recoveryDirection).toBeNull();
  });

  it('ignores delayed errors from the previous station', () => {
    configureStations(['old-station', 'current-station'], 1, 'ready');
    const stalePlayer = createPlayer('old-station');

    emitError(stalePlayer);
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(1);
    expect(component.radioStatus).toBe('ready');
    expect(component.recoveryDirection).toBeNull();
  });

  it('does not let a stale playing event cancel current recovery', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    component.nextVideo();
    emitError(createPlayer(component.currentVideoId));
    emitState(createPlayer('station-a'), 1);

    expect(component.radioStatus).toBe('recovering');

    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
  });

  it('invalidates an old timer even after returning to the same video id', () => {
    configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError();
    jasmine.clock().tick(300);
    component.nextVideo();
    component.previousVideo();

    expect(component.currentVideoId).toBe('station-a');

    jasmine.clock().tick(component.autoAdvanceDelayMs - 299);

    expect(component.currentVideoId).toBe('station-a');
    expect(component.currentIndex).toBe(0);
  });

  it('ignores an old mount callback after returning to the same video id', () => {
    configureStations(['station-a', 'station-b'], 0, 'playing');

    component.nextVideo();
    component.previousVideo();

    const staleFirstAttempt = createPlayer('station-a');
    component.onPlayerReady(
      { target: staleFirstAttempt } as unknown as YT.PlayerEvent,
      0
    );

    expect(component.currentVideoId).toBe('station-a');
    expect(component.radioStatus).toBe('loading-player');
    expect(staleFirstAttempt.setVolume).not.toHaveBeenCalled();

    const currentAttempt = createPlayer('station-a');
    component.onPlayerReady({ target: currentAttempt } as unknown as YT.PlayerEvent);

    expect(currentAttempt.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
  });

  it('preserves playback intent across rapid station changes', () => {
    configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    component.selectVideo(1);
    component.selectVideo(2);

    const player = createPlayer('station-c');
    component.onPlayerReady({ target: player } as unknown as YT.PlayerEvent);

    expect(component.currentVideoId).toBe('station-c');
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
  });

  it('ignores ready from the retired player and waits for the fresh player', () => {
    const retiredPlayer = configureStations(['station-a', 'station-b'], 0, 'playing');

    component.selectVideo(1);
    component.onPlayerReady({ target: retiredPlayer } as unknown as YT.PlayerEvent);

    expect(component.radioStatus).toBe('loading-player');
    expect(retiredPlayer.playVideo).not.toHaveBeenCalled();

    const freshPlayer = createPlayer('station-b');
    component.onPlayerReady({ target: freshPlayer } as unknown as YT.PlayerEvent);

    expect(freshPlayer.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
  });

  it('stops automatic recovery after every station has failed once', () => {
    const player = configureStations(['station-a', 'station-b', 'station-c'], 0, 'playing');

    emitError(player);
    expect(component.radioStatus).toBe('recovering');
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    emitError(createPlayer(component.currentVideoId));
    expect(component.radioStatus).toBe('recovering');
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    emitError(createPlayer(component.currentVideoId));
    jasmine.clock().tick(component.autoAdvanceDelayMs);

    expect(component.currentIndex).toBe(2);
    expect(component.currentVideoId).toBe('station-c');
    expect(component.radioStatus).toBe('exhausted');
    expect(component.recoveryDirection).toBeNull();
    expect(component.showPlaySpinner).toBeFalse();
    expect(component.isPlayerControlDisabled).toBeFalse();

    jasmine.clock().tick(component.autoAdvanceDelayMs * 3);

    expect(component.currentIndex).toBe(2);
    expect(component.radioStatus).toBe('exhausted');
  });

  it('exhausts immediately when the only station fails', () => {
    configureStations(['only-station'], 0, 'playing');

    emitError();

    expect(component.radioStatus).toBe('exhausted');
    expect(component.recoveryDirection).toBeNull();
    expect(component.showPlaySpinner).toBeFalse();

    jasmine.clock().tick(component.autoAdvanceDelayMs * 2);
    expect(component.currentIndex).toBe(0);
  });

  it('reconnects without reviving the recovery timer that offline cancelled', () => {
    const firstPlayer = configureStations(['station-a', 'station-b'], 0, 'playing');

    emitError(firstPlayer);
    jasmine.clock().tick(500);
    component.handleOffline();
    component.handleOnline();
    jasmine.clock().tick(0);

    expect(component.radioStatus).toBe('loading-player');
    expect(component.showPlaySpinner).toBeTrue();

    jasmine.clock().tick(component.autoAdvanceDelayMs);
    expect(component.currentIndex).toBe(0);

    const replacementPlayer = createPlayer('station-a');
    component.onPlayerReady({ target: replacementPlayer } as unknown as YT.PlayerEvent);

    expect(replacementPlayer.playVideo).toHaveBeenCalledTimes(1);
    expect(component.radioStatus).toBe('buffering');
  });

  function configureStations(
    videoIds: string[],
    currentIndex: number,
    initialStatus: 'ready' | 'paused' | 'playing'
  ): ReturnType<typeof createPlayer> {
    component.videoIds = videoIds;
    component.videoTitles = videoIds.map((_, index) => `Station ${index + 1}`);
    component.videoOwners = videoIds.map(() => '');
    component.totalVideos = videoIds.length;
    component.currentIndex = currentIndex;
    component.currentVideoId = videoIds[currentIndex] || '';
    component.isPlayerReady = true;
    component.isPlaying = false;
    component.radioStatus = 'ready';

    const player = createPlayer(component.currentVideoId);
    component.player = player;
    spyOn(component, 'noise');

    if (initialStatus === 'playing') {
      emitState(player, 1);
    } else if (initialStatus === 'paused') {
      emitState(player, 2);
    }

    return player;
  }

  function emitError(player?: ReturnType<typeof createPlayer>, errorCode = 100): void {
    const event = player
      ? { target: player, data: errorCode }
      : { data: errorCode };
    component.onPlayerError(event as unknown as YT.OnErrorEvent);
  }

  function emitState(player: ReturnType<typeof createPlayer>, state: number): void {
    component.onPlayerStateChange({ target: player, data: state } as unknown as YT.OnStateChangeEvent);
  }
});

function createPlayer(videoId = ''): jasmine.SpyObj<YT.Player> & { getVideoData: jasmine.Spy } {
  const player = jasmine.createSpyObj<YT.Player>('YouTubePlayer', [
    'setVolume',
    'playVideo',
    'pauseVideo'
  ]) as jasmine.SpyObj<YT.Player> & { getVideoData: jasmine.Spy };
  player.getVideoData = jasmine.createSpy('getVideoData').and.returnValue({ video_id: videoId });
  return player;
}
