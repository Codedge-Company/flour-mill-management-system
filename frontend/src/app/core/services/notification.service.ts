// src/app/core/services/notification.service.ts
import { Injectable, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification';
import { ApiResponse } from '../models/api-response';

export interface SocketNotification {
  notificationId: string;
  type: string;
  message: string;
  currentStock?: number;
  packName?: string;
  packWeight?: number;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  // Signals for reactive UI
  unreadCount = signal<number>(0);
  newNotifications = signal<Notification[]>([]);
  isSocketConnected = signal<boolean>(false);

  private socket: Socket | null = null;
  private token: string | null = null;

  constructor(private http: HttpClient) {
    this.initSocket();

    // Auto-sync unread count when new notifications arrive
    effect(() => {
      const count = this.newNotifications().filter(n => !n.isRead).length;
      this.unreadCount.set(count);
    });
  }

  // -----------------------------------------------------
  // Helper methods for UI (used in template)
  // -----------------------------------------------------

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      LOW_STOCK: '⚠️',
      OUT_OF_STOCK: '🚨',
      REORDER_NEEDED: '🔄',
      STOCK_UPDATE: '📊'
    };
    return icons[type] ?? 'ℹ️';
  }

  getTypeClass(type: string): string {
    const map: Record<string, string> = {
      LOW_STOCK: 'type-warning',
      OUT_OF_STOCK: 'type-error',
      REORDER_NEEDED: 'type-info',
      STOCK_UPDATE: 'type-success'
    };
    return map[type] ?? 'type-info';
  }

  getFormattedType(type: string): string {
    return type.replace(/_/g, ' ');
  }

  // -----------------------------------------------------
  // Socket and HTTP logic (same as before)
  // -----------------------------------------------------

  private initSocket(): void {
    this.token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

    if (!this.token) {
      console.warn('No auth token found for Socket.IO');
      return;
    }

    this.socket = io(environment.apiUrl, {
      auth: { token: this.token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      this.isSocketConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
      this.isSocketConnected.set(false);
    });

    // Real-time events
    this.socket.on('newNotification', (data: { notification: SocketNotification }) => {
      console.log('🔔 New notification:', data.notification);
      const notification: Notification = {
        notificationId: data.notification.notificationId,
        type: data.notification.type as any,
        message: data.notification.message,
        isRead: data.notification.isRead,
        createdAt: data.notification.createdAt,
        packName: data.notification.packName,
        currentStock: data.notification.currentStock
      };
      this.newNotifications.update(list => [notification, ...list]);
    });

    this.socket.on('unreadCountUpdate', (data: { count: number }) => {
      this.unreadCount.set(data.count);
    });
  }

  // HTTP Methods (unchanged)
  getAll(): Observable<ApiResponse<Notification[]>> {
    return this.http.get<ApiResponse<Notification[]>>(this.apiUrl);
  }

  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(`${this.apiUrl}/unread-count`)
      .pipe(tap(res => this.unreadCount.set(res.data.count)));
  }

  markRead(notificationId: string): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(tap(() => {
        this.unreadCount.update(c => Math.max(0, c - 1));
        this.newNotifications.update(list =>
          list.map(n => n.notificationId === notificationId ? { ...n, isRead: true } : n)
        );
      }));
  }

  markAllRead(): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/read-all`, {})
      .pipe(tap(() => {
        this.unreadCount.set(0);
        this.newNotifications.set([]);
      }));
  }

  reconnect(): void {
    if (this.socket) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  mapApiToNotification(item: any): Notification {
  return {
    notificationId: item._id,
    type: item.type as 'LOW_STOCK' | 'OUT_OF_STOCK' | 'REORDER_NEEDED' | 'STOCK_UPDATE',
    message: item.message,
    isRead: item.is_read,
    createdAt: item.created_at,
    packName: item.pack_type_id?.pack_name,
    currentStock: item.current_stock
  };
}
}
