import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory';

@Component({
  selector: 'app-bag-stock-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './bag-stock-panel.component.html',
  styleUrl: './bag-stock-panel.component.css',
})
export class BagStockPanelComponent implements OnInit {
  items = signal<InventoryItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.inventoryService.getAll().subscribe({
      next: res => { this.items.set(res.data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load bag stock.'); this.loading.set(false); },
    });
  }

  get totalBags(): number {
    return this.items().reduce((sum, i) => sum + i.stockQty, 0);
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }

  getBarPercent(item: InventoryItem): number {
    if (item.stockQty === 0) return 0;
    const max = Math.max(item.threshold * 3, item.stockQty);
    return Math.min(100, (item.stockQty / max) * 100);
  }
}
