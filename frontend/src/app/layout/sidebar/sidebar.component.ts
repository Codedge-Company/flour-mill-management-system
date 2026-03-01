// sidebar.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule }  from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService }   from '../../core/services/auth.service';

interface NavItem {
  label:     string;
  route:     string;
  /** PrimeNG icon class e.g. 'pi-home' */
  icon:      string;
  adminOnly?: boolean;
  badge?:    string | number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl:    './sidebar.component.css',
})
export class SidebarComponent {
  @Input() collapsed    = false;
  @Input() mobileOpen   = false;
  @Output() closeMenu   = new EventEmitter<void>();

  readonly navItems: NavItem[] = [
    { label: 'Dashboard',       route: '/dashboard',       icon: 'pi-home' },
    { label: 'Sales',           route: '/sales',           icon: 'pi-shopping-cart' },
    { label: 'Customers',       route: '/customers',       icon: 'pi-users' },
    { label: 'Inventory',       route: '/inventory',       icon: 'pi-box',          adminOnly: true },
    { label: 'Notifications',   route: '/notifications',   icon: 'pi-bell' },
    { label: 'User Management', route: '/user-management', icon: 'pi-user-edit',    adminOnly: true },
  ];

  constructor(readonly authService: AuthService) {}

  get visibleItems(): NavItem[] {
    return this.navItems.filter(
      item => !item.adminOnly || this.authService.isAdmin()
    );
  }
}