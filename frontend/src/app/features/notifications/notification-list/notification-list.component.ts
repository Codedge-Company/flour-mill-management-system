import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';                          // ← removed RouterLinkActive
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type FilterTab = 'all' | 'unread';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, TimeAgoPipe], // ← removed RouterLinkActive
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.css'
})
export class NotificationListComponent implements OnInit {
  notifications = signal<Notification[]>([]);
  loading       = signal(true);
  markingAll    = signal(false);
  error         = signal<string | null>(null);
  activeTab     = signal<FilterTab>('all');

  displayed = computed(() =>
    this.activeTab() === 'unread'
      ? this.notifications().filter(n => !n.isRead)
      : this.notifications()
  );

  unreadCount = computed(() => this.notifications().filter(n => !n.isRead).length);

  constructor(public notificationService: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notificationService.getAll().subscribe({
      next: res => {
        this.notifications.set(
          res.data.map((i: any) => this.notificationService.mapApiToNotification(i)) // ← typed as any
        );
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
      next: () => this.notifications.update(list =>
        list.map(n => n.notificationId === notification.notificationId ? { ...n, isRead: true } : n)
      )
    });
  }

  markAllRead(): void {
    if (this.unreadCount() === 0 || this.markingAll()) return;
    this.markingAll.set(true);
    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this.markingAll.set(false);
      },
      error: () => this.markingAll.set(false)
    });
  }

  setTab(tab: FilterTab): void           { this.activeTab.set(tab); }
  getTypeIcon    = (t: string) => this.notificationService.getTypeIcon(t);
  getTypeClass   = (t: string) => this.notificationService.getTypeClass(t);
  getFormattedType = (t: string) => this.notificationService.getFormattedType(t);
  trackByNotificationId = (_: number, n: Notification) => n.notificationId;
}
