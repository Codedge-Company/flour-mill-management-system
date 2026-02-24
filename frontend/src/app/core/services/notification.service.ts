// src/app/core/services/notification.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  // Signal so topbar bell updates instantly
  unreadCount = signal<number>(0);

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Notification[]>> {
    return this.http.get<ApiResponse<Notification[]>>(this.apiUrl);
  }

  getUnreadCount(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(
      `${this.apiUrl}/unread-count`
    ).pipe(
      tap(res => this.unreadCount.set(res.data.count))
    );
  }

  markRead(notificationId: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.apiUrl}/${notificationId}/read`, {}
    ).pipe(
      tap(() => this.unreadCount.update(c => Math.max(0, c - 1)))
    );
  }

  markAllRead(): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.apiUrl}/read-all`, {}
    ).pipe(
      tap(() => this.unreadCount.set(0))
    );
  }
}