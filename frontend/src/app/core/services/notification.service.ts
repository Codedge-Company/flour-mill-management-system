// src/app/core/services/notification.service.ts
import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ToastrService } from 'ngx-toastr';
import { AudioService } from './audio.service';
import { PushNotificationService } from './push-notification.service';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification';

const TOKEN_KEY = 'mfm_token';   // ✅ must match auth.service.ts

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  unreadCount       = signal<number>(0);
  newNotifications  = signal<Notification[]>([]);
  isSocketConnected = signal<boolean>(false);

  private socket: Socket | null = null;
  private isBrowser: boolean;

  private toastr   = inject(ToastrService);
  private audioSvc = inject(AudioService);
  private pushSvc  = inject(PushNotificationService);

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: object   // ✅ SSR guard
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  connect(): void {
    if (!this.isBrowser) return;   // ✅ skip on SSR server

    const token = localStorage.getItem(TOKEN_KEY);  // ✅ correct key
    if (!token) {
      console.warn('[NotifService] No token — socket not connected');
      return;
    }

    if (this.socket?.connected) {
      console.log('[NotifService] Socket already connected');
      return;
    }

    const socketUrl = environment.apiUrl.replace('/api', '');
    console.log('[NotifService] Connecting to:', socketUrl);

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected. ID:', this.socket?.id);
      this.isSocketConnected.set(true);
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket connect_error:', err.message);
      this.isSocketConnected.set(false);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket disconnected:', reason);
      this.isSocketConnected.set(false);
    });

    // Temporary: logs ALL socket events — remove after confirmed working
    this.socket.onAny((event: string, ...args: any[]) => {
      console.log(`[Socket DEBUG] "${event}"`, args);
    });

    this.socket.on('newNotification', (data: any) => {
      console.log('🔔 newNotification received:', data);
      const raw = data.notification ?? data;
      const notification: Notification = this.mapSocketToNotification(raw);

      this.newNotifications.update(list => [notification, ...list]);
      this.audioSvc.playForNew([notification]);
      this.showToast(notification);
      this.pushSvc.sendLocalPush(notification);
    });

    this.socket.on('unreadCountUpdate', (data: { count: number }) => {
      console.log('🔢 unreadCountUpdate:', data.count);
      this.unreadCount.set(data.count);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.isSocketConnected.set(false);
    this.audioSvc.reset();
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  private showToast(n: Notification): void {
    const icon    = this.getTypeIcon(n.type);
    const title   = `${icon} ${this.getFormattedType(n.type)}`;
    const stock   = n.currentStock !== undefined ? ` — Stock: ${n.currentStock}` : '';
    const message = n.packName ? `${n.packName}: ${n.message}${stock}` : n.message;
    const base    = { progressBar: true, closeButton: true, enableHtml: false, tapToDismiss: true };

    switch (n.type) {
      case 'OUT_OF_STOCK':   this.toastr.error(message, title,   { ...base, timeOut: 0, disableTimeOut: true }); break;
      case 'LOW_STOCK':      this.toastr.warning(message, title, { ...base, timeOut: 7000 }); break;
      case 'REORDER_NEEDED': this.toastr.info(message, title,    { ...base, timeOut: 6000 }); break;
      default:               this.toastr.success(message, title, { ...base, timeOut: 5000 });
    }
  }

  getAll(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  getUnreadCount(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/unread-count`)
      .pipe(tap(res => this.unreadCount.set(res.data.count)));
  }

  markRead(notificationId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(tap(() => {
        this.unreadCount.update(c => Math.max(0, c - 1));
        this.newNotifications.update(list =>
          list.map(n => n.notificationId === notificationId ? { ...n, isRead: true } : n)
        );
      }));
  }

  markAllRead(): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/read-all`, {})
      .pipe(tap(() => {
        this.unreadCount.set(0);
        this.newNotifications.update(list => list.map(n => ({ ...n, isRead: true })));
      }));
  }

  clearPanel(): void {
    this.newNotifications.set([]);
  }

  mapApiToNotification(item: any): Notification {
    return {
      notificationId: item._id,
      type:           item.type,
      message:        item.message,
      isRead:         item.is_read,
      createdAt:      item.created_at,
      packName:       item.pack_type_id?.pack_name,
      currentStock:   item.current_stock
    };
  }

  private mapSocketToNotification(raw: any): Notification {
    return {
      notificationId: raw.notificationId ?? raw._id,
      type:           raw.type,
      message:        raw.message,
      isRead:         raw.isRead ?? raw.is_read ?? false,
      createdAt:      raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
      packName:       raw.packName ?? raw.pack_type_id?.pack_name,
      currentStock:   raw.currentStock ?? raw.current_stock
    };
  }

  getTypeIcon(type: string): string {
    return ({ LOW_STOCK: '⚠️', OUT_OF_STOCK: '🚨', REORDER_NEEDED: '🔄', STOCK_UPDATE: '📊' } as any)[type] ?? 'ℹ️';
  }
  getTypeClass(type: string): string {
    return ({ LOW_STOCK: 'type-warning', OUT_OF_STOCK: 'type-error', REORDER_NEEDED: 'type-info', STOCK_UPDATE: 'type-success' } as any)[type] ?? 'type-info';
  }
  getFormattedType(type: string): string { return type.replace(/_/g, ' '); }
}
