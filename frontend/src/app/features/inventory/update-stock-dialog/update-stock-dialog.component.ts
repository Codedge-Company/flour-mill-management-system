// src/app/features/inventory/update-stock-dialog/update-stock-dialog.component.ts
import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryItem } from '../../../core/models/inventory';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-update-stock-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-stock-dialog.component.html',
  styleUrl: './update-stock-dialog.component.css'
})
export class UpdateStockDialogComponent {
  @Input() item!: InventoryItem;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  loading = signal(false);
  error   = signal<string | null>(null);

  constructor(private fb: FormBuilder, private inventoryService: InventoryService) {
    this.form = this.fb.group({
      addQty: [null, [Validators.required, Validators.min(1), Validators.max(99999)]]
    });
  }

  get newTotal(): number {
    const qty = this.form.get('addQty')?.value ?? 0;
    return (this.item?.stockQty ?? 0) + Number(qty);
  }

  get f() { return this.form.controls; }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    console.log('Submitting stock update:', {
      packTypeId: this.item.packTypeId,
      addQty: this.form.value.addQty
    });
    this.inventoryService.addStock({
      packTypeId: this.item.packTypeId,
      addQty: this.form.value.addQty
    }).subscribe({
      next: () => { this.loading.set(false); this.saved.emit(); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update stock.');
      }
    });
  }
}