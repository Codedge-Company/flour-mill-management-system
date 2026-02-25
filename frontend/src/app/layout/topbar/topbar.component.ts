// src/app/layout/topbar/topbar.component.ts
import {
  Component, Output, EventEmitter, OnInit, signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css'
})
export class TopbarComponent implements OnInit {
  @Output() toggleSidebar = new EventEmitter<void>();

  showUserMenu = signal(false);

  constructor(
    readonly authService: AuthService,
    readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.notificationService.getUnreadCount().subscribe();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu.update(v => !v);
  }

  logout(): void {
    this.authService.logout();
  }
  @HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target.closest('.user-menu-wrapper')) {
    this.showUserMenu.set(false);
  }
}
}