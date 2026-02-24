// src/app/features/inventory/inventory-list/inventory-list.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { UpdateStockDialogComponent } from '../update-stock-dialog/update-stock-dialog.component';
import { UpdateCostDialogComponent } from '../update-cost-dialog/update-cost-dialog.component';
import { CostHistoryDialogComponent } from '../cost-history-dialog/cost-history-dialog.component';
import { ThresholdDialogComponent } from '../threshold-dialog/threshold-dialog.component';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    LkrCurrencyPipe,
    TimeAgoPipe,
    UpdateStockDialogComponent,
    UpdateCostDialogComponent,
    CostHistoryDialogComponent,
    ThresholdDialogComponent
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.css'
})
export class InventoryListComponent implements OnInit {
  items   = signal<InventoryItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  // Dialog state
  selectedItem = signal<InventoryItem | null>(null);
  showAddStock    = signal(false);
  showUpdateCost  = signal(false);
  showCostHistory = signal(false);
  showThreshold   = signal(false);

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.inventoryService.getAll().subscribe({
      next: res => {
        this.items.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load inventory. Please try again.');
        this.loading.set(false);
      }
    });
  }

  openAddStock(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.showAddStock.set(true);
  }

  openUpdateCost(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.showUpdateCost.set(true);
  }

  openCostHistory(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.showCostHistory.set(true);
  }

  openThreshold(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.showThreshold.set(true);
  }

  closeAll(): void {
    this.showAddStock.set(false);
    this.showUpdateCost.set(false);
    this.showCostHistory.set(false);
    this.showThreshold.set(false);
    this.selectedItem.set(null);
  }

  onDialogSuccess(): void {
    this.closeAll();
    this.load();
  }

  getStockStatus(item: InventoryItem): 'ok' | 'low' | 'out' {
    if (item.stockQty === 0)         return 'out';
    if (item.isLowStock)             return 'low';
    return 'ok';
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }
  // Add helper method to inventory-list.component.ts class:
getBarPercent(item: InventoryItem): number {
  if (item.stockQty === 0) return 0;
  const max = Math.max(item.threshold * 3, item.stockQty);
  return Math.min(100, (item.stockQty / max) * 100);
}
}