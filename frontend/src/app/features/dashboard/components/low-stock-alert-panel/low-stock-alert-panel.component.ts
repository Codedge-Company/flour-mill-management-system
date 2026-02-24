// src/app/features/dashboard/components/low-stock-alert-panel/low-stock-alert-panel.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryItem } from '../../../../core/models/inventory';

@Component({
  selector: 'app-low-stock-alert-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (loading) {
      @for (n of [1,2,3]; track n) {
        <div class="alert-skeleton"></div>
      }
    } @else if (items.length === 0) {
      <div class="all-good">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none"
             viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>All stocks are healthy</p>
      </div>
    } @else {
      <div class="alert-list">
        @for (item of items; track item.packTypeId) {
          <div class="alert-item">
            <div class="alert-item-left">
              <span class="pack-badge">{{ item.packName }}</span>
              <div class="alert-meta">
                <span class="stock-val" [class.critical]="item.stockQty === 0">
                  {{ item.stockQty }} packs
                </span>
                <span class="threshold-val">
                  Threshold: {{ item.threshold }}
                </span>
              </div>
            </div>
            <div class="stock-bar-wrap">
              <div
                class="stock-bar"
                [style.width.%]="getBarPercent(item)"
                [class.critical]="item.stockQty === 0"
              ></div>
            </div>
          </div>
        }

        <a [routerLink]="['/inventory']" class="btn btn-outline btn-sm view-inv-btn">
          Manage Inventory
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </a>
      </div>
    }
  `,
  styles: [`
    .alert-skeleton {
      height: 52px;
      background: linear-gradient(90deg, var(--border) 25%, var(--surface-alt) 50%, var(--border) 75%);
      background-size: 200% 100%;
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      animation: shimmer 1.4s infinite;
    }

    .all-good {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 32px 16px;
      color: var(--success);
    }
    .all-good p { font-size: 13px; font-weight: 500; }

    .alert-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .alert-item {
      background: var(--danger-light);
      border: 1px solid #fca5a5;
      border-radius: var(--radius-md);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .alert-item-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pack-badge {
      background: var(--danger);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;
      white-space: nowrap;
    }

    .alert-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .stock-val {
      font-size: 13px;
      font-weight: 600;
      color: var(--danger);
    }
    .stock-val.critical { color: #7f1d1d; }

    .threshold-val {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .stock-bar-wrap {
      height: 5px;
      background: #fca5a5;
      border-radius: 99px;
      overflow: hidden;
    }

    .stock-bar {
      height: 100%;
      background: var(--danger);
      border-radius: 99px;
      min-width: 4px;
      transition: width .4s ease;
    }
    .stock-bar.critical { background: #7f1d1d; }

    .view-inv-btn {
      width: 100%;
      justify-content: center;
      margin-top: 4px;
    }
  `]
})
export class LowStockAlertPanelComponent {
  @Input() items: InventoryItem[] = [];
  @Input() loading = false;

  getBarPercent(item: InventoryItem): number {
    if (item.stockQty === 0) return 2;
    const max = item.threshold * 2;
    return Math.min(100, (item.stockQty / max) * 100);
  }
}