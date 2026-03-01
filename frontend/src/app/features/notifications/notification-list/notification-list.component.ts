import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AudioService } from '../../../core/services/audio.service';  // Add if created
import { Notification } from '../../../core/models/notification';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type FilterTab = 'all' | 'unread';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, PageHeaderComponent, TimeAgoPipe],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.css'
})
export class NotificationListComponent implements OnInit {
  notifications = signal<Notification[]>([]);
  loading = signal(true);
  markingAll = signal(false);
  error = signal<string | null>(null);
  activeTab = signal<FilterTab>('all');

  // Audio detection
  private audioService = inject(AudioService, { optional: true });
  private lastUnreadCount = 0;

  displayed = computed(() =>
    this.activeTab() === 'unread'
      ? this.notifications().filter(n => !n.isRead)
      : this.notifications()
  );

  unreadCount = computed(() =>
    this.notifications().filter(n => !n.isRead).length
  );

  constructor(private notificationService: NotificationService) { }

 ngOnInit(): void {
    this.load();
    
    // Listen for new notifications (Socket.IO)
    effect(() => {
      const newNotifs = this.notificationService.newNotifications();
      if (newNotifs.length > 0) {
        // Merge new with existing or play sound
        this.playNewNotificationSound();
      }
    });
  }
  private playNewNotificationSound(): void {
    if (this.audioService) {
      const newNotifs = this.notificationService.newNotifications();
      const alertType = newNotifs.some(n => n.type === 'LOW_STOCK' || n.type === 'OUT_OF_STOCK')
        ? 'LOW_STOCK' : 'STOCK_UPDATE';
      this.audioService.play(alertType);
    }
  }
  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notificationService.getAll().subscribe({
      next: res => {
        const currentUnread = res.data.filter(n => !n.isRead).length;

        // Play sound if new unread notifications
        if (this.audioService && currentUnread > this.lastUnreadCount && currentUnread > 0) {
          const unreadNotifs = res.data.filter(n => !n.isRead);
          const alertType = unreadNotifs.some(n => n.type === 'LOW_STOCK' || n.type === 'OUT_OF_STOCK')
            ? 'LOW_STOCK' : 'STOCK_UPDATE';
          this.audioService.play(alertType);
        }

        this.lastUnreadCount = currentUnread;
        this.notifications.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load notifications.');
        this.loading.set(false);
      }
    });
  }

  markRead(notification: Notification): void {
    if (notification.isRead) return;

    this.notificationService.markRead(notification.notificationId).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n =>
            n.notificationId === notification.notificationId
              ? { ...n, isRead: true }
              : n
          )
        );
      }
    });
  }

  markAllRead(): void {
    if (this.unreadCount() === 0 || this.markingAll()) return;
    this.markingAll.set(true);

    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => ({ ...n, isRead: true }))
        );
        this.markingAll.set(false);
      },
      error: () => this.markingAll.set(false)
    });
  }

  setTab(tab: FilterTab): void {
    this.activeTab.set(tab);
  }

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

  trackByNotificationId(index: number, notif: Notification): string {
    return notif.notificationId;
  }
  getFormattedType(type: string): string {
    return type.replace(/_/g, ' ');
  }

}
