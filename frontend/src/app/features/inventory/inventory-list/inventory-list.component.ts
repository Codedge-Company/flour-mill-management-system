import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { UpdateStockDialogComponent } from '../update-stock-dialog/update-stock-dialog.component';
import { UpdateCostDialogComponent } from '../update-cost-dialog/update-cost-dialog.component';
import { CostHistoryDialogComponent } from '../cost-history-dialog/cost-history-dialog.component';
import { ThresholdDialogComponent } from '../threshold-dialog/threshold-dialog.component';
import { CreatePackTypeDialogComponent } from '../create-pack-type-dialog/create-pack-type-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RequestStockDialogComponent } from '../request-stock-dialog/request-stock-dialog.component';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    CommonModule,
    LkrCurrencyPipe,
    TimeAgoPipe,
    UpdateStockDialogComponent,
    UpdateCostDialogComponent,
    CostHistoryDialogComponent,
    ThresholdDialogComponent,
    CreatePackTypeDialogComponent,
    ConfirmDialogComponent,
    RequestStockDialogComponent,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.css',
})
export class InventoryListComponent implements OnInit {
  items = signal<InventoryItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // ── Dialog state ────────────────────────────────────────────────
  selectedItem = signal<InventoryItem | null>(null);
  showAddStock = signal(false);
  showUpdateCost = signal(false);
  showCostHistory = signal(false);
  showThreshold = signal(false);
  showCreatePackType = signal(false);
  deleteTarget = signal<InventoryItem | null>(null);
  deleteLoading = signal(false);
  editingPackId = signal<string | null>(null);
  editingNameValue = signal<string>('');
  saveNameLoading = signal(false);
  showRequestStock = signal(false);

  constructor(private inventoryService: InventoryService) { }

  ngOnInit(): void {
    this.load();
  }

  // ── Data loading ─────────────────────────────────────────────────
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
      },
    });
  }

  // ── Open dialogs ─────────────────────────────────────────────────
  openCreatePackType(): void {
    this.showCreatePackType.set(true);
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

  confirmDelete(item: InventoryItem): void {
    this.deleteTarget.set(item);
  }

  // ── Close all ────────────────────────────────────────────────────
  closeAll(): void {
    this.showAddStock.set(false);
    this.showUpdateCost.set(false);
    this.showCostHistory.set(false);
    this.showThreshold.set(false);
    this.showCreatePackType.set(false);
    this.deleteTarget.set(null);
    this.selectedItem.set(null);
    this.showRequestStock.set(false);
    this.cancelEdit();
  }

  // ── Success handlers ──────────────────────────────────────────────
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
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  getStockStatus(item: InventoryItem): 'ok' | 'low' | 'out' {
    if (item.stockQty === 0) return 'out';
    if (item.isLowStock) return 'low';
    return 'ok';
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }

  get outOfStockCount(): number {
    return this.items().filter(i => i.stockQty === 0).length;
  }

  /**
   * Width of the progress fill bar as a percentage (0–100).
   * Scale: max = 3× threshold OR current stock, whichever is greater.
   */
  getBarPercent(item: InventoryItem): number {
    if (item.stockQty === 0) return 0;
    const max = Math.max(item.threshold * 3, item.stockQty);
    return Math.min(100, (item.stockQty / max) * 100);
  }

  /**
   * Left position of the threshold marker as a percentage.
   */
  getThresholdPercent(item: InventoryItem): number {
    const max = Math.max(item.threshold * 3, item.stockQty);
    return Math.min(100, (item.threshold / max) * 100);
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }
  startEditName(item: InventoryItem): void {
    this.editingPackId.set(item.packTypeId);
    this.editingNameValue.set(item.packName);
  }

  cancelEdit(): void {
    this.editingPackId.set(null);
    this.editingNameValue.set('');
  }

  savePackName(item: InventoryItem): void {
    const newName = this.editingNameValue().trim();
    if (!newName || newName === item.packName) {
      this.cancelEdit();
      return;
    }

    this.saveNameLoading.set(true);

    this.inventoryService.updatePackName(item.packTypeId, newName).subscribe({
      next: () => {
        this.saveNameLoading.set(false);
        this.cancelEdit();
        this.showSuccess(`Pack name updated to "${newName}".`);
        this.load();
      },
      error: err => {
        this.saveNameLoading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update pack name.');
      },
    });
  }
  openRequestStock(item: InventoryItem): void {
    this.selectedItem.set(item);
    this.showRequestStock.set(true);
  }

  onRequestStockSuccess(): void {
    this.closeAll();
    this.showSuccess('Stock request submitted successfully.');
  }
}