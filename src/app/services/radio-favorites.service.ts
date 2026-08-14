import { Injectable } from '@angular/core';

const FAVORITE_VIDEO_IDS_KEY = 'favoriteVideoIds';
const LEGACY_FAVORITES_KEY = 'favorites';

@Injectable({ providedIn: 'root' })
export class RadioFavoritesService {
  private favoriteIds = new Set<string>();
  private knownStationIds = new Set<string>();
  private isLoaded = false;

  load(stationVideoIds: readonly string[]): ReadonlySet<string> {
    this.knownStationIds = new Set(this.normalizeVideoIds(stationVideoIds));
    const hasCanonicalValue = this.hasStorageItem(FAVORITE_VIDEO_IDS_KEY);
    const storedIds = hasCanonicalValue ? this.readIdList(FAVORITE_VIDEO_IDS_KEY) : null;

    if (hasCanonicalValue) {
      // localStorage is shared by tabs; treat the latest persisted value as
      // canonical instead of overwriting it with a stale in-memory Set.
      this.favoriteIds = new Set(storedIds || []);
      this.isLoaded = true;
      this.persist();
      return new Set(this.favoriteIds);
    }

    this.favoriteIds = new Set(this.migrateLegacyFavorites(stationVideoIds));
    this.isLoaded = true;

    if (this.persist()) {
      this.removeStorageItem(LEGACY_FAVORITES_KEY);
    }

    return new Set(this.favoriteIds);
  }

  isFavorite(videoId: string): boolean {
    return this.favoriteIds.has(this.normalizeVideoId(videoId));
  }

  toggle(videoId: string): boolean {
    const normalizedId = this.normalizeVideoId(videoId);

    if (
      !normalizedId
      || (this.knownStationIds.size > 0 && !this.knownStationIds.has(normalizedId))
    ) {
      return false;
    }

    if (!this.isLoaded) {
      this.load([]);
    } else if (this.hasStorageItem(FAVORITE_VIDEO_IDS_KEY)) {
      this.favoriteIds = new Set(this.readIdList(FAVORITE_VIDEO_IDS_KEY) || []);
    }

    const willBeFavorite = !this.favoriteIds.has(normalizedId);

    if (willBeFavorite) {
      this.favoriteIds.add(normalizedId);
    } else {
      this.favoriteIds.delete(normalizedId);
    }

    this.persist();
    return willBeFavorite;
  }

  getAll(): readonly string[] {
    return [...this.favoriteIds];
  }

  private migrateLegacyFavorites(stationVideoIds: readonly string[]): string[] {
    const legacyValue = this.readJson(LEGACY_FAVORITES_KEY);

    if (!Array.isArray(legacyValue)) {
      return [];
    }

    if (legacyValue.every(value => typeof value === 'string')) {
      return this.normalizeVideoIds(legacyValue);
    }

    if (legacyValue.every(value => typeof value === 'boolean')) {
      return this.normalizeVideoIds(
        stationVideoIds.filter((_, index) => legacyValue[index] === true)
      );
    }

    return [];
  }

  private readIdList(key: string): string[] | null {
    const value = this.readJson(key);

    if (!Array.isArray(value)) {
      return null;
    }

    return this.normalizeVideoIds(
      value.filter((item): item is string => typeof item === 'string')
    );
  }

  private normalizeVideoIds(videoIds: readonly string[]): string[] {
    return Array.from(new Set(
      videoIds
        .map(videoId => this.normalizeVideoId(videoId))
        .filter((videoId): videoId is string => Boolean(videoId))
    ));
  }

  private normalizeVideoId(videoId: string): string {
    return typeof videoId === 'string' ? videoId.trim() : '';
  }

  private readJson(key: string): unknown {
    const storage = this.getStorage();

    if (!storage) {
      return null;
    }

    try {
      const value = storage.getItem(key);
      return value === null ? null : JSON.parse(value);
    } catch {
      return null;
    }
  }

  private persist(): boolean {
    const storage = this.getStorage();

    if (!storage) {
      return false;
    }

    try {
      storage.setItem(FAVORITE_VIDEO_IDS_KEY, JSON.stringify(this.getAll()));
      return true;
    } catch {
      return false;
    }
  }

  private removeStorageItem(key: string): void {
    try {
      this.getStorage()?.removeItem(key);
    } catch {
      // Favorites still work in memory if storage is unavailable.
    }
  }

  private hasStorageItem(key: string): boolean {
    try {
      return this.getStorage()?.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  private getStorage(): Storage | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  }
}
