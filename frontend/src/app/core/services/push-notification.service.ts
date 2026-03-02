// src/app/core/services/push-notification.service.ts
import { Injectable, Optional, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly VAPID_PUBLIC_KEY = environment.vapidPublicKey;
  private isBrowser: boolean;

  constructor(
    @Optional() private swPush: SwPush,
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Handle OS notification click → navigate to correct page
    if (this.isBrowser && this.swPush?.isEnabled) {
      this.swPush.notificationClicks.subscribe(({ notification }) => {
        const url = (notification.data as any)?.url ?? '/notifications';
        this.router.navigate([url]);
      });
    }
  }

  requestPermissionAndSubscribe(): void {
    if (!this.isBrowser) return;

    if (!this.swPush || !this.swPush.isEnabled) {
      if (environment.production) {
        console.warn('[Push] Service Worker not enabled');
      }
      return;
    }

    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') return;

      this.swPush.requestSubscription({ serverPublicKey: this.VAPID_PUBLIC_KEY })
        .then(sub => {
          // ✅ correct URL — /api/notifications/subscribe
          this.http.post(`${environment.apiUrl}/notifications/subscribe`, sub).subscribe({
            next: () => console.log('[Push] ✅ Subscribed to web push'),
            error: err => console.error('[Push] Subscribe failed:', err)
          });
        })
        .catch(err => console.error('[Push] Subscription request failed:', err));
    });
  }

  // Local push — works when browser tab is open (no SW needed)
  sendLocalPush(n: {
    type: string;
    message: string;
    packName?: string;
    currentStock?: number;
  }): void {
    if (!this.isBrowser) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

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
      icon:               '/assets/icons/icon-192x192.png',
      badge:              '/assets/icons/badge-72x72.png',
      tag:                n.type,
      requireInteraction: n.type === 'OUT_OF_STOCK',
    });
  }
}
