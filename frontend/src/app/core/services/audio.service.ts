// src/app/core/services/audio.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio: HTMLAudioElement | null = null;   // null on server
  private playedIds = new Set<string>();
  private userHasInteracted = false;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Only initialize browser APIs on the client
    if (this.isBrowser) {
      this.audio = new Audio('/assets/sounds/stock-update.mp3');
      this.audio.preload = 'auto';

      const unlock = () => {
        this.userHasInteracted = true;
        this.audio?.load();
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('keydown', unlock);
    }
  }

  playForNew(notifications: { notificationId: string; type: string }[]): void {
    if (!this.isBrowser || !this.audio) return;  // ← skip on server

    const fresh = notifications.filter(n => !this.playedIds.has(n.notificationId));
    if (fresh.length === 0) return;

    fresh.forEach(n => this.playedIds.add(n.notificationId));

    if (!this.userHasInteracted) {
      console.warn('[AudioService] Autoplay blocked — waiting for user interaction');
      return;
    }

    const isAlert = fresh.some(n => n.type === 'LOW_STOCK' || n.type === 'OUT_OF_STOCK');
    this.audio.volume = isAlert ? 0.8 : 0.5;
    this.audio.currentTime = 0;
    this.audio.play().catch(err => console.warn('[AudioService] Play failed:', err));
  }

  reset(): void { this.playedIds.clear(); }
}
