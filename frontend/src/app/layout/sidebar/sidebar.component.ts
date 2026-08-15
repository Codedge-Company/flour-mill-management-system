import { Component, Input, Output, EventEmitter, Signal, computed, effect } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  pageKey?: string;
  badge?: string | number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() closeMenu = new EventEmitter<void>();

  readonly navItems: NavItem[] = [
    { label: 'Dashboard',         route: '/dashboard',           icon: 'pi-home',         pageKey: 'dashboard' },
    { label: 'Sales',             route: '/sales',               icon: 'pi-shopping-cart', pageKey: 'sales' },
    { label: 'Customers',         route: '/customers',           icon: 'pi-users',        pageKey: 'customers' },
    { label: 'Inventory',         route: '/inventory',           icon: 'pi-box',          pageKey: 'inventory' },
    { label: 'Material Store',    route: '/material-store',      icon: 'pi-warehouse',    pageKey: 'material-store' },
    { label: 'Notifications',     route: '/notifications',       icon: 'pi-bell',         pageKey: 'notifications' },
    { label: 'User Management',   route: '/user-management',     icon: 'pi-user-edit',    pageKey: 'user-management' },
    { label: 'Budget Management', route: '/budget',              icon: 'pi-chart-bar',    pageKey: 'budget' },
    { label: 'Flow Money',        route: '/flow-money',          icon: 'pi-dollar',       pageKey: 'flow-money' },
    { label: 'Milling Analysis',  route: '/milling-analysis',    icon: 'pi-chart-pie',    pageKey: 'milling-analysis' },
    // { label: 'Grind Sessions',    route: '/operators-dashboard', icon: 'pi-cog',          pageKey: 'operators-dashboard' },
    // { label: 'Sift Session',      route: '/sifting-dashboard',   icon: 'pi-filter',       pageKey: 'sifting-dashboard' },
    { label: 'Order Management',  route: '/order-management',    icon: 'pi-shopping-bag', pageKey: 'order-management' },
  ];

  readonly displayName: Signal<string> = computed(() => {
    const u: any = this.authService.currentUser();
    return (u?.fullName ?? u?.full_name ?? '').trim();
  });

  readonly avatarLabel: Signal<string> = computed(() => {
    const name = this.displayName();
    return (name?.charAt(0) || '?').toUpperCase();
  });

  constructor(
    readonly authService: AuthService,
    readonly permissionService: PermissionService,
  ) {
    // Load permissions whenever the authenticated user changes
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.permissionService.ensureLoaded().subscribe();
      } else {
        // On logout, clear the permission cache
        this.permissionService.clearCache();
      }
    });
  }

  get visibleItems(): NavItem[] {
    return this.navItems.filter(
      item => !item.pageKey || this.permissionService.canAccess(item.pageKey)
    );
  }
}