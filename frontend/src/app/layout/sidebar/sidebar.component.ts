// src/app/layout/sidebar/sidebar.component.ts
import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Input() collapsed = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'grid' },
    { label: 'Sales', route: '/sales', icon: 'shopping-cart' },
    { label: 'Customers', route: '/customers', icon: 'users' },
    { label: 'Inventory', route: '/inventory', icon: 'package', adminOnly: true },
    { label: 'Notifications', route: '/notifications', icon: 'bell' },
    { label: 'User Management', route: '/user-management', icon: 'user-cog', adminOnly: true },
  ];

  constructor(readonly authService: AuthService) { }

  get visibleItems(): NavItem[] {
    return this.navItems.filter(
      item => !item.adminOnly || this.authService.isAdmin()
    );
  }

  getIcon(name: string): string {
    const icons: Record<string, string> = {
      'grid': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                 <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
               </svg>`,
      'shopping-cart': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                 <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
               </svg>`,
      'users': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                 <circle cx="9" cy="7" r="4"/>
                 <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
               </svg>`,
      'package': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8
                          a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                 <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                 <line x1="12" y1="22.08" x2="12" y2="12"/>
               </svg>`,
      'bell': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                 <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
               </svg>`,
      'user-cog': `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                 <circle cx="12" cy="7" r="4"/>
                 <circle cx="19" cy="19" r="2"/>
                 <path d="M19 15v1.5M19 22.5V21M15.7 16.7l1.1 1.1M22.2 22.2l-1.1-1.1
                          M15 19h1.5M22.5 19H21M15.7 21.3l1.1-1.1M22.2 16.8l-1.1 1.1"/>
               </svg>`,
    };
    return icons[name] ?? '';
  }
}