// src/app/features/inventory/threshold-dialog/threshold-dialog.component.ts
import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryItem } from '../../../core/models/inventory';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-threshold-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './threshold-dialog.component.html',
  styleUrl: './threshold-dialog.component.css'
})
export class ThresholdDialogComponent implements OnInit {
  @Input() item!: InventoryItem;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  loading = signal(false);
  error   = signal<string | null>(null);

  constructor(private fb: FormBuilder, private inventoryService: InventoryService) {
    this.form = this.fb.group({
      thresholdQty: [null, [Validators.required, Validators.min(0), Validators.max(99999)]]
    });
  }

  ngOnInit(): void {
    this.form.patchValue({ thresholdQty: this.item.threshold });
  }

  get f() { return this.form.controls; }

  get willTriggerAlert(): boolean {
    const t = this.form.get('thresholdQty')?.value ?? 0;
    return this.item.stockQty <= Number(t);
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.inventoryService.updateThreshold({
      packTypeId: this.item.packTypeId,
      thresholdQty: this.form.value.thresholdQty
    }).subscribe({
      next: () => { this.loading.set(false); this.saved.emit(); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update threshold.');
      }
    });
  }
}