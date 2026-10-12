import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../../core/services/inventory.service';
import { DailySheetService } from '../../../core/services/daily-sheet.service';
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

  // inline editing of the empty-bag count (opening balance / correction)
  editingId = signal<string | null>(null);
  savingId = signal<string | null>(null);
  editError = signal<string | null>(null);
  editValue: number | null = null;

  constructor(
    private inventoryService: InventoryService,
    private dailySheet: DailySheetService,
  ) {}

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

  get totalEmptyBags(): number {
    return this.items().reduce((sum, i) => sum + (i.emptyBagQty ?? 0), 0);
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }

  isEmptyLow(item: InventoryItem): boolean {
    return (item.emptyBagThreshold ?? 0) > 0 && (item.emptyBagQty ?? 0) <= item.emptyBagThreshold;
  }

  getBarPercent(item: InventoryItem): number {
    if (item.stockQty === 0) return 0;
    const max = Math.max(item.threshold * 3, item.stockQty);
    return Math.min(100, (item.stockQty / max) * 100);
  }

  // ── Empty bag count editing ──────────────────────────────────────────
  startEdit(item: InventoryItem): void {
    this.editError.set(null);
    this.editValue = item.emptyBagQty ?? 0;
    this.editingId.set(item.packTypeId);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  onEditInput(event: Event): void {
    const v = (event.target as HTMLInputElement).valueAsNumber;
    this.editValue = isNaN(v) ? null : v;
  }

  saveEdit(item: InventoryItem): void {
    if (this.editValue === null || !Number.isInteger(this.editValue) || this.editValue < 0) {
      this.editError.set('Enter a whole number, 0 or more.');
      return;
    }
    this.savingId.set(item.packTypeId);
    this.editError.set(null);
    this.dailySheet.setEmptyBags(item.packTypeId, { setQty: this.editValue }).subscribe({
      next: res => {
        this.items.update(list => list.map(i =>
          i.packTypeId === item.packTypeId
            ? { ...i, emptyBagQty: res.emptyBagQty, emptyBagThreshold: res.emptyBagThreshold }
            : i));
        this.savingId.set(null);
        this.editingId.set(null);
      },
      error: e => {
        this.savingId.set(null);
        this.editError.set(e?.error?.message || 'Could not save the empty bag count.');
      },
    });
  }
}
