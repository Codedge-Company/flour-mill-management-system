import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-create-pack-type-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-pack-type-dialog.component.html',
  styleUrl:    './create-pack-type-dialog.component.css'
})
export class CreatePackTypeDialogComponent {
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  loading = signal(false);
  error   = signal<string | null>(null);

  // Quick presets so admin can fill 1KG/5KG/10KG/25KG in one click
  readonly presets = [
    { label: '1KG',  packName: '1KG',  weightKg: 1,  cost: 219,  threshold: 15 },
    { label: '5KG',  packName: '5KG',  weightKg: 5,  cost: 1050, threshold: 10 },
    { label: '10KG', packName: '10KG', weightKg: 10, cost: 2050, threshold: 10 },
    { label: '25KG', packName: '25KG', weightKg: 25, cost: 5000, threshold: 5  },
  ];

  get f() { return this.form.controls; }

  constructor(
    private fb: FormBuilder,
    private inventoryService: InventoryService
  ) {
    this.form = this.fb.group({
      packName:     ['', [Validators.required, Validators.maxLength(20)]],
      weightKg:     [null, [Validators.required, Validators.min(1)]],
      initialStock: [0,    [Validators.required, Validators.min(0)]],
      initialCost:  [null, [Validators.required, Validators.min(0.01)]],
      thresholdQty: [5,    [Validators.required, Validators.min(0)]]
    });
  }

  applyPreset(preset: typeof this.presets[0]): void {
    this.form.patchValue({
      packName:     preset.packName,
      weightKg:     preset.weightKg,
      initialCost:  preset.cost,
      thresholdQty: preset.threshold
    });
    this.error.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    this.inventoryService.createPackType({
      packName:     this.form.value.packName.trim().toUpperCase(),
      weightKg:     this.form.value.weightKg,
      initialStock: this.form.value.initialStock,
      initialCost:  this.form.value.initialCost,
      thresholdQty: this.form.value.thresholdQty
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.saved.emit();
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to create pack type.');
      }
    });
  }
}
