// topbar.component.ts
import { Component, Output, EventEmitter, OnInit, signal, HostListener, inject, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Notification } from '../../core/models/notification';
import { AvatarModule } from 'primeng/avatar';
import { UserResponse } from '../../core/services/user.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css'],
})
export class TopbarComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() openMobile = new EventEmitter<void>();

  public authService = inject(AuthService);
  public notificationService = inject(NotificationService);
  private router = inject(Router);

  showUserMenu = signal(false);
  showNotifPanel = signal(false);

  readonly unreadCount = this.notificationService.unreadCount;
  readonly isSocketConnected = this.notificationService.isSocketConnected;

  readonly displayName: Signal<string> = computed(() => {
    const u: any = this.authService.currentUser();
    return (u?.fullName ?? u?.full_name ?? '').trim();
  });

  readonly avatarLabel: Signal<string> = computed(() => {
    const name = this.displayName();
    return (name?.charAt(0) || '?').toUpperCase();
  });

  ngOnInit(): void {
    this.notificationService.getUnreadCount().subscribe();
    this.notificationService.getAll().subscribe(res => {
      const mapped: Notification[] = res.data
        .map((item: any) => this.notificationService.mapApiToNotification(item))
        .slice(0, 10);
      this.notificationService.newNotifications.set(mapped);
    });
  }

  onToggle(): void { this.toggleSidebar.emit(); }
  toggleUserMenu(): void {
    this.showUserMenu.update(v => !v);
    this.showNotifPanel.set(false);
  }
  toggleNotifPanel(): void {
    this.showNotifPanel.update(v => !v);
    this.showUserMenu.set(false);
  }
  markReadAndNavigate(n: any): void {
    if (!n.isRead) this.notificationService.markRead(n.notificationId).subscribe();
    this.showNotifPanel.set(false);
    switch (n.type) {
      case 'LOW_STOCK': case 'OUT_OF_STOCK': case 'REORDER_NEEDED': case 'STOCK_UPDATE':
        this.router.navigate(['/inventory']); break;
      default: this.router.navigate(['/notifications']);
    }
  }
  logout(): void {
    this.authService.logout();
    this.notificationService.disconnect();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) this.showUserMenu.set(false);
    if (!target.closest('.bell-wrapper')) this.showNotifPanel.set(false);
  }
}
