// src/app/core/services/push-notification.service.ts
import { Injectable, Optional, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly VAPID_PUBLIC_KEY = environment.vapidPublicKey;
  private isBrowser: boolean;

  // ── Utility: single source of truth for Notification API support ────────
  private get isPushSupported(): boolean {
    return (
      this.isBrowser &&
      typeof Notification !== 'undefined' &&    
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  constructor(
    @Optional() private swPush: SwPush,
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser && this.swPush?.isEnabled) {
      this.swPush.notificationClicks.subscribe(({ notification }) => {
        const url = (notification.data as any)?.url ?? '/notifications';
        this.router.navigate([url]);
      });
    }
  }

  requestPermissionAndSubscribe(): void {
    // ✅ Check Notification API exists BEFORE touching it
    if (!this.isPushSupported) return;

    if (!this.swPush || !this.swPush.isEnabled) {
      if (environment.production) {
        console.warn('[Push] Service Worker not enabled');
      }
      return;
    }

    // ✅ Safe to call now — Notification is confirmed to exist
    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') return;

      this.swPush.requestSubscription({ serverPublicKey: this.VAPID_PUBLIC_KEY })
        .then(sub => {
          this.http.post(`${environment.apiUrl}/notifications/subscribe`, sub).subscribe({
            next: () => console.log('[Push] ✅ Subscribed to web push'),
            error: err => console.error('[Push] Subscribe failed:', err)
          });
        })
        .catch(err => console.error('[Push] Subscription request failed:', err));
    });
  }

  sendLocalPush(n: {
    type: string;
    message: string;
    packName?: string;
    currentStock?: number;
  }): void {
    // ✅ Already correctly guarded
    if (!this.isPushSupported) return;
    if (Notification.permission !== 'granted') return;

    const titles: Record<string, string> = {
      LOW_STOCK:      '⚠️ Low Stock Alert',
      OUT_OF_STOCK:   '🚨 Out of Stock!',
      REORDER_NEEDED: '🔄 Reorder Needed',
      STOCK_UPDATE:   '📊 Stock Updated'
    };

    const body = n.packName
      ? `${n.packName}: ${n.message}${n.currentStock !== undefined ? ' (Stock: ' + n.currentStock + ')' : ''}`
      : n.message;

    new Notification(titles[n.type] ?? '🔔 Notification', {
      body,
      icon:               '/assets/icons/icon.png',
      badge:              '/assets/icons/badge.png',
      tag:                n.type,
      requireInteraction: n.type === 'OUT_OF_STOCK',
    });
  }
}
