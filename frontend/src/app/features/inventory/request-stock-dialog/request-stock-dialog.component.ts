import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryItem } from '../../../core/models/inventory';
import { StockRequestService } from '../../../core/services/stock-request.service';
@Component({
  selector: 'app-request-stock-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request-stock-dialog.component.html',
  styleUrl: './request-stock-dialog.component.css',
})
export class RequestStockDialogComponent {
  @Input({ required: true }) item!: InventoryItem;
  @Output() submitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  qty = signal<number | null>(null);
  loading = signal(false);
  submitError = signal<string | null>(null);
  qtyError = '';

  /** Quick-pick options relative to current stock & threshold */
  get quickOptions(): number[] {
    const recommended = this.recommendedQty;
    const opts = new Set([
      recommended,
      recommended * 2,
      Math.max(50, Math.ceil(recommended / 50) * 50),
      100,
    ]);
    return Array.from(opts)
      .filter(v => v > 0)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }

  /** Minimum recommended packs to reach the threshold */
  get recommendedQty(): number {
    const deficit = (this.item.threshold ?? 0) - (this.item.stockQty ?? 0);
    return Math.max(deficit, 10);
  }

  constructor(private stockRequestService: StockRequestService) { }

  onQtyInput(value: string): void {
    const parsed = parseInt(value, 10);
    this.qty.set(isNaN(parsed) ? null : parsed);
    this.qtyError = '';
    this.submitError.set(null);
  }

  setQty(value: number): void {
    this.qty.set(value);
    this.qtyError = '';
    this.submitError.set(null);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.onCancel();
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    const qtyVal = this.qty();

    // Validate
    if (!qtyVal || qtyVal <= 0) {
      this.qtyError = 'Please enter a valid quantity greater than 0.';
      return;
    }
    if (!Number.isInteger(qtyVal)) {
      this.qtyError = 'Quantity must be a whole number.';
      return;
    }

    this.loading.set(true);
    this.submitError.set(null);

    this.stockRequestService.createRequest({
      packTypeId: this.item.packTypeId,
      packName: this.item.packName,
      weightKg: this.item.weightKg,
      qty: qtyVal,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.emit();
      },
      error: (err) => {
        this.loading.set(false);
        this.submitError.set(err?.error?.message ?? 'Failed to submit stock request. Please try again.');
      },
    });
  }
}