// main-layout.component.ts
import { Component, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent }  from '../topbar/topbar.component';
import { LoadingService }   from '../../core/services/loading.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  sidebarCollapsed = signal(false);
  /** Mobile drawer open state (separate from desktop collapse) */
  mobileOpen = signal(false);

  constructor(readonly loadingService: LoadingService) {}

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      // On mobile: toggle drawer instead of collapsing
      this.mobileOpen.update(v => !v);
    } else {
      this.sidebarCollapsed.update(v => !v);
    }
  }

  openMobile(): void  { this.mobileOpen.set(true); }
  closeMobile(): void { this.mobileOpen.set(false); }

  /** Close drawer on Escape */
  @HostListener('document:keydown.escape')
  onEscape(): void { this.mobileOpen.set(false); }
}