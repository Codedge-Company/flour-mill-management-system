// src/app/shared/pipes/status-badge.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

export interface BadgeConfig {
  label: string;
  cssClass: string;
}

@Pipe({ name: 'statusBadge', standalone: true })
export class StatusBadgePipe implements PipeTransform {
  private readonly map: Record<string, BadgeConfig> = {
    SAVED:      { label: 'Saved',      cssClass: 'badge badge-success' },
    CANCELLED:  { label: 'Cancelled',  cssClass: 'badge badge-danger'  },
    CASH:       { label: 'Cash',       cssClass: 'badge badge-info'    },
    CARD:       { label: 'Card',       cssClass: 'badge badge-primary' },
    BANK:       { label: 'Bank',       cssClass: 'badge badge-warning' },
    LOW_STOCK:  { label: 'Low Stock',  cssClass: 'badge badge-danger'  },
    ADMIN:      { label: 'Admin',      cssClass: 'badge badge-primary' },
    SALES:      { label: 'Sales',      cssClass: 'badge badge-info'    },
  };

  transform(value: string): BadgeConfig {
    return this.map[value] ?? { label: value, cssClass: 'badge badge-info' };
  }
}