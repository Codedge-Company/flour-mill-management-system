import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/notification';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

type FilterTab = 'all' | 'unread';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, TimeAgoPipe],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.css'
})
export class NotificationListComponent implements OnInit {
  notifications  = signal<Notification[]>([]);
  loading        = signal(true);
  markingAll     = signal(false);
  error          = signal<string | null>(null);
  activeTab      = signal<FilterTab>('all');

  displayed = computed(() =>
    this.activeTab() === 'unread'
      ? this.notifications().filter(n => !n.isRead)
      : this.notifications()
  );

  unreadCount = computed(() =>
    this.notifications().filter(n => !n.isRead).length
  );

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notificationService.getAll().subscribe({
      next: res => {
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
      LOW_STOCK: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0
                 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9"  x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>`
    };
    return icons[type] ?? '';
  }

  getTypeClass(type: string): string {
    const map: Record<string, string> = {
      LOW_STOCK: 'type-warning'
    };
    return map[type] ?? 'type-info';
  }
}