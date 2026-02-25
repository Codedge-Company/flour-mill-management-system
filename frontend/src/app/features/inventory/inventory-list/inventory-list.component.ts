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
import { CreatePackTypeDialogComponent } from '../create-pack-type-dialog/create-pack-type-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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
    ThresholdDialogComponent,
    CreatePackTypeDialogComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl:    './inventory-list.component.css'
})
export class InventoryListComponent implements OnInit {
  items   = signal<InventoryItem[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Dialog state
  selectedItem        = signal<InventoryItem | null>(null);
  showAddStock        = signal(false);
  showUpdateCost      = signal(false);
  showCostHistory     = signal(false);
  showThreshold       = signal(false);
  showCreatePackType  = signal(false);
  deleteTarget        = signal<InventoryItem | null>(null);
  deleteLoading       = signal(false);

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

  // ── Open dialogs ─────────────────────────────────────────────
  openCreatePackType(): void    { this.showCreatePackType.set(true); }
  openAddStock(item: InventoryItem): void {
    this.selectedItem.set(item); this.showAddStock.set(true);
  }
  openUpdateCost(item: InventoryItem): void {
    this.selectedItem.set(item); this.showUpdateCost.set(true);
  }
  openCostHistory(item: InventoryItem): void {
    this.selectedItem.set(item); this.showCostHistory.set(true);
  }
  openThreshold(item: InventoryItem): void {
    this.selectedItem.set(item); this.showThreshold.set(true);
  }
  confirmDelete(item: InventoryItem): void {
    this.deleteTarget.set(item);
  }

  // ── Close all ────────────────────────────────────────────────
  closeAll(): void {
    this.showAddStock.set(false);
    this.showUpdateCost.set(false);
    this.showCostHistory.set(false);
    this.showThreshold.set(false);
    this.showCreatePackType.set(false);
    this.deleteTarget.set(null);
    this.selectedItem.set(null);
  }

  // ── Success handlers ─────────────────────────────────────────
  onPackTypeCreated(): void {
    this.closeAll();
    this.showSuccess('Pack type created successfully.');
    this.load();
  }

  onDialogSuccess(): void {
    this.closeAll();
    this.load();
  }

  onDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleteLoading.set(true);

    this.inventoryService.deletePackType(target.packTypeId).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.showSuccess(`"${target.packName}" removed successfully.`);
        this.load();
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to delete pack type.');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  getStockStatus(item: InventoryItem): 'ok' | 'low' | 'out' {
    if (item.stockQty === 0) return 'out';
    if (item.isLowStock)     return 'low';
    return 'ok';
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }

  getBarPercent(item: InventoryItem): number {
    if (item.stockQty === 0) return 0;
    const max = Math.max(item.threshold * 3, item.stockQty);
    return Math.min(100, (item.stockQty / max) * 100);
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }
}
