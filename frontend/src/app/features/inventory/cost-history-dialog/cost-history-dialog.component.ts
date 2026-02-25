// src/app/features/inventory/cost-history-dialog/cost-history-dialog.component.ts
import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryItem } from '../../../core/models/inventory';
import { CostHistory } from '../../../core/models/cost-history';
import { InventoryService } from '../../../core/services/inventory.service';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-cost-history-dialog',
  standalone: true,
  imports: [CommonModule, LkrCurrencyPipe],
  templateUrl: './cost-history-dialog.component.html',
  styleUrl: './cost-history-dialog.component.css'
})
export class CostHistoryDialogComponent implements OnInit {
  @Input() item!: InventoryItem;
  @Output() closed = new EventEmitter<void>();

  history = signal<CostHistory[]>([]);
  loading = signal(true);
  error   = signal<string | null>(null);

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
            console.log('Cost history loaded:', this.item);
    this.inventoryService.getCostHistory(this.item.packTypeId).subscribe({
      next: res => {
        this.history.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load cost history.');
        this.loading.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getCostChange(index: number): number | null {
    if (index === this.history().length - 1) return null;
    return this.history()[index].unitCost - this.history()[index + 1].unitCost;
  }
}