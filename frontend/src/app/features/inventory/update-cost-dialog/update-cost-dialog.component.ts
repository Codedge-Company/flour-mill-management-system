// src/app/features/inventory/update-cost-dialog/update-cost-dialog.component.ts
import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryItem } from '../../../core/models/inventory';
import { InventoryService } from '../../../core/services/inventory.service';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-update-cost-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LkrCurrencyPipe],
  templateUrl: './update-cost-dialog.component.html',
  styleUrl: './update-cost-dialog.component.css'
})
export class UpdateCostDialogComponent implements OnInit {
  @Input() item!: InventoryItem;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  loading = signal(false);
  error   = signal<string | null>(null);

  /** Today's date in YYYY-MM-DD format for the date input default & max */
  readonly todayStr: string;

  constructor(private fb: FormBuilder, private inventoryService: InventoryService) {
    // Build today string once
    const now = new Date();
    this.todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    this.form = this.fb.group({
      unitCost:      [null, [Validators.required, Validators.min(0.01)]],
      effectiveFrom: [this.todayStr, [Validators.required]],  // ← new date field
    });
  }

  ngOnInit(): void {
    // Reset date to today every time the dialog opens
    this.form.patchValue({ effectiveFrom: this.todayStr });
  }

  get f() { return this.form.controls; }

  get costDiff(): number {
    const newCost = this.form.get('unitCost')?.value ?? 0;
    return Number(newCost) - (this.item?.currentCost ?? 0);
  }

  get costDiffClass(): string {
    if (this.costDiff > 0) return 'diff-up';
    if (this.costDiff < 0) return 'diff-down';
    return '';
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.inventoryService.updateCost({
      packTypeId:    this.item.packTypeId,
      unitCost:      this.form.value.unitCost,
      effectiveFrom: this.form.value.effectiveFrom,   // ← pass date to service
    }).subscribe({
      next: () => { this.loading.set(false); this.saved.emit(); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update cost.');
      }
    });
  }
}