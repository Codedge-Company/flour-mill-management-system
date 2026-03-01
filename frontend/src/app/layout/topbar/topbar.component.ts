// topbar.component.ts
import { Component, Output, EventEmitter, OnInit, signal, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Notification } from '../../core/models/notification'; // referenced only via service

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css'],
})
export class TopbarComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() openMobile = new EventEmitter<void>();

  showUserMenu = signal(false);
  showNotifPanel = signal(false);

  readonly unreadCount = this.notificationService.unreadCount;
  readonly isSocketConnected = this.notificationService.isSocketConnected;

  constructor(
    public authService: AuthService,
    public notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.notificationService.getUnreadCount().subscribe();

    // Prime the bell panel with the latest 10 notifications
    this.notificationService.getAll().subscribe(res => {
      const mapped: Notification[] = res.data
        .map(item => this.notificationService.mapApiToNotification(item))
        .slice(0, 10);

      this.notificationService.newNotifications.set(mapped);
    });
  }

  onToggle(): void {
    this.toggleSidebar.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu.set(false);
  }

  toggleNotifPanel(): void {
    this.showNotifPanel.update(v => !v);
    this.showUserMenu.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.notificationService.disconnect();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.user-menu-wrapper')) {
      this.showUserMenu.set(false);
    }

    if (!target.closest('.bell-wrapper')) {
      this.showNotifPanel.set(false);
    }
  }
}
