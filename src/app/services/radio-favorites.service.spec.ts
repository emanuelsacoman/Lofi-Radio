import { RadioFavoritesService } from './radio-favorites.service';

describe('RadioFavoritesService', () => {
  let service: RadioFavoritesService;

  beforeEach(() => {
    localStorage.clear();
    service = new RadioFavoritesService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('toggles and persists stable video ids', () => {
    service.load(['station-a', 'station-b', 'station-c']);

    service.toggle('station-b');
    service.toggle('station-a');

    expect(service.isFavorite('station-a')).toBeTrue();
    expect(service.isFavorite('station-b')).toBeTrue();
    expect(readStoredIds().sort()).toEqual(['station-a', 'station-b']);

    service.toggle('station-b');

    expect(service.isFavorite('station-b')).toBeFalse();
    expect(readStoredIds()).toEqual(['station-a']);
  });

  it('restores favorites independently of catalog order', () => {
    localStorage.setItem('favoriteVideoIds', JSON.stringify(['station-b']));

    service.load(['station-c', 'station-a', 'station-b']);

    expect(service.isFavorite('station-a')).toBeFalse();
    expect(service.isFavorite('station-b')).toBeTrue();
    expect(service.isFavorite('station-c')).toBeFalse();
  });

  it('merges a toggle with the latest value written by another tab', () => {
    service.load(['station-a', 'station-b']);
    localStorage.setItem('favoriteVideoIds', JSON.stringify(['station-b']));

    service.toggle('station-a');

    expect(service.isFavorite('station-a')).toBeTrue();
    expect(service.isFavorite('station-b')).toBeTrue();
    expect(readStoredIds().sort()).toEqual(['station-a', 'station-b']);
  });

  it('sanitizes canonical storage without forgetting temporarily absent stations', () => {
    localStorage.setItem(
      'favoriteVideoIds',
      JSON.stringify([' station-b ', 'station-b', '', 42, null, 'missing-station'])
    );

    service.load(['station-a', 'station-b']);

    expect(service.isFavorite('station-b')).toBeTrue();
    expect(service.isFavorite('missing-station')).toBeTrue();
    expect(readStoredIds()).toEqual(['station-b', 'missing-station']);
  });

  it('migrates positional legacy favorites after station ids are available', () => {
    localStorage.setItem('favorites', JSON.stringify([false, true, false, true]));

    service.load(['station-a', 'station-b', 'station-c']);

    expect(service.isFavorite('station-a')).toBeFalse();
    expect(service.isFavorite('station-b')).toBeTrue();
    expect(service.isFavorite('station-c')).toBeFalse();
    expect(readStoredIds()).toEqual(['station-b']);
    expect(localStorage.getItem('favorites')).toBeNull();
  });

  it('never lets legacy data override an existing canonical value', () => {
    localStorage.setItem('favoriteVideoIds', JSON.stringify([]));
    localStorage.setItem('favorites', JSON.stringify([true, true]));

    service.load(['station-a', 'station-b']);

    expect(service.isFavorite('station-a')).toBeFalse();
    expect(service.isFavorite('station-b')).toBeFalse();
    expect(readStoredIds()).toEqual([]);
  });

  it('recovers safely from malformed canonical storage without using legacy positions', () => {
    localStorage.setItem('favoriteVideoIds', '{not-json');
    localStorage.setItem('favorites', JSON.stringify([true, true]));

    expect(() => service.load(['station-a', 'station-b'])).not.toThrow();
    expect(service.isFavorite('station-a')).toBeFalse();
    expect(service.isFavorite('station-b')).toBeFalse();
    expect(readStoredIds()).toEqual([]);
  });

  it('ignores blank or unknown ids passed to toggle', () => {
    service.load(['station-a']);

    service.toggle('');
    service.toggle('   ');
    service.toggle('missing-station');

    expect(readStoredIds()).toEqual([]);
    expect(service.isFavorite('station-a')).toBeFalse();
  });

  function readStoredIds(): string[] {
    return JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]') as string[];
  }
});
