// low-stock-alert-panel.component.ts
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink }   from '@angular/router';
import { InventoryItem } from '../../../../core/models/inventory';

@Component({
  selector: 'app-low-stock-alert-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './low-stock-alert-panel.component.html',
  styleUrls:   ['./low-stock-alert-panel.component.css'],
})
export class LowStockAlertPanelComponent {
  @Input() items:   InventoryItem[] = [];
  @Input() loading = false;

  getBarPct(item: InventoryItem): number {
    if (item.stockQty === 0) return 0;
    const safeLevel = item.threshold * 2;
    return Math.min(100, (item.stockQty / safeLevel) * 100);
  }
}