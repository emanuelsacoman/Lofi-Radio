import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';

import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class ShareService {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private clipboard: Clipboard,
    private toastService: ToastService
  ) {}

  async shareSite(): Promise<void> {
    const siteUrl = this.getSiteUrl();
    const shareData: ShareData = {
      title: 'Lofi Radio',
      text: 'Your 24/7 soundtrack for focus, quiet study, and late-night unwinding.',
      url: siteUrl
    };
    const navigator = this.document.defaultView?.navigator;

    if (typeof navigator?.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (this.isShareCancelled(error)) {
          return;
        }
      }
    }

    if (this.clipboard.copy(siteUrl)) {
      this.toastService.success('Link copied.', 'Share Lofi Radio', 3000);
      return;
    }

    this.toastService.error('Unable to share.', 'Could not copy the link.', 5000);
  }

  private getSiteUrl(): string {
    const canonicalUrl = this.document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.href;

    if (canonicalUrl) {
      return canonicalUrl;
    }

    const currentUrl = this.document.defaultView?.location.href;

    if (!currentUrl) {
      return 'https://lofiradio.web.app/';
    }

    return new URL('/', currentUrl).href;
  }

  private isShareCancelled(error: unknown): boolean {
    return typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError';
  }
}
